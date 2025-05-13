import os
from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.utils import secure_filename
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime
import requests
import uuid

load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)

@app.route("/")
def index():
    return redirect(url_for("login"))

# Configuração do Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Allowed image extensions
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# Função auxiliar para verificar se o usuário está logado
def is_logged_in():
    return "user" in session

# Upload file to Supabase Storage and return public URL
def upload_file_to_supabase_storage(file, folder):
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        file_data = file.read()
        try:
            # Removed bucket existence check to avoid false negatives
            supabase.storage.from_(folder).upload(unique_filename, file_data)
            public_url = supabase.storage.from_(folder).get_public_url(unique_filename)
            return public_url
        except Exception as e:
            print(f"Error uploading file to Supabase Storage: {e}")
            return None
    return None

# Rota de login
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        # Use a API REST do Supabase para fazer o login
        try:
            response = supabase.auth.sign_in_with_password({"email": email, "password": password})
            if response.user:
                # Armazene apenas o ID e o e-mail do usuário na sessão para evitar problemas de serialização
                session["user"] = {"id": response.user.id, "email": response.user.email}
                return redirect(url_for("profile"))
            else:
                flash("Falha no login. Verifique suas credenciais.")
        except Exception as e:
            flash(f"Erro no login: {str(e)}")
    return render_template("login.html")

# Rota de logout
@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("login"))

# Rota de perfil - upload de foto e registro de atividade
@app.route("/profile", methods=["GET", "POST"])
def profile():
    if not is_logged_in():
        return redirect(url_for("login"))
    user = session["user"]
    profile = None
    # Fetch profile data from Supabase
    response = supabase.table("profiles").select("*").eq("user_id", user["id"]).execute()
    if response.data and len(response.data) > 0:
        profile = response.data[0]
    if request.method == "POST":
        name = request.form.get("name")
        activity = request.form.get("activity")
        photo = request.files.get("photo")
        photo_url = None
        if photo:
            photo_url = upload_file_to_supabase_storage(photo, "profile-photos")
        # Salve ou atualize o perfil do usuário no Supabase
        data = {
            "user_id": user["id"],
            "name": name,
            "activity": activity,
            "photo_url": photo_url,
        }
        # Upsert do perfil
        supabase.table("profiles").upsert(data, on_conflict=["user_id"]).execute()
        flash("Perfil atualizado.")
        # Refresh profile data after update
        response = supabase.table("profiles").select("*").eq("user_id", user["id"]).execute()
        if response.data and len(response.data) > 0:
            profile = response.data[0]
    return render_template("profile.html", user=user, profile=profile)

from datetime import timedelta

from flask import jsonify

@app.route("/daily", methods=["GET", "POST"])
def daily():
    if not is_logged_in():
        return redirect(url_for("login"))
    user = session["user"]
    profile = None
    # Fetch profile data from Supabase
    response_profile = supabase.table("profiles").select("*").eq("user_id", user["id"]).execute()
    if response_profile.data and len(response_profile.data) > 0:
        profile = response_profile.data[0]

    # Determine the date to view/edit, set to None if no valid date provided
    date_str = request.args.get("date")
    if date_str:
        try:
            selected_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            selected_date = None
    else:
        selected_date = None

    # Adjust start_date to be fixed date 12/05/2025
    import datetime as dt
    base_date = dt.date(2025, 5, 12)
    start_date = base_date

    # Debug logging for date values
    print(f"[DEBUG] base_date: {base_date}, start_date: {start_date}, selected_date: {selected_date}")

    if request.method == "POST":
        if selected_date is None:
            flash("Data inválida para conclusão diária.")
            return redirect(url_for("daily"))
        comment = request.form.get("comment")
        photo = request.files.get("photo")
        photo_url = None
        if photo and allowed_file(photo.filename):
            photo_url = upload_file_to_supabase_storage(photo, "daily-photos")
        else:
            # If no new photo uploaded, keep existing photo_url if any
            existing = supabase.table("daily_completions")\
                .select("photo_url")\
                .eq("user_id", user["id"])\
                .eq("date", selected_date.isoformat())\
                .maybe_single().execute()
            if existing and existing.data:
                photo_url = existing.data.get("photo_url")


        data = {
            "user_id": user["id"],
            "completed": True,
            "comment": comment,
            "photo_url": photo_url,
            "date": selected_date.isoformat()
        }
        # Upsert daily completion with unique constraint on user_id and date
        supabase.table("daily_completions").upsert(data, on_conflict="user_id,date").execute()

        # If AJAX request, return JSON with updated completion data and progress info
        if request.headers.get("X-Requested-With") == "XMLHttpRequest":
            # Recalculate progress stats after upsert
            response_all = supabase.table("daily_completions")\
                .select("*")\
                .eq("user_id", user["id"])\
                .gte("date", start_date.isoformat())\
                .order("date", desc=False)\
                .execute()
            completions = []
            if response_all.data:
                for c in response_all.data:
                    c['date'] = c['date'].strftime('%Y-%m-%d') if hasattr(c['date'], 'strftime') else c['date']
                    completions.append(c)
            total_days = 66
            completed_days = len([c for c in completions if c["completed"]])
            progress_percent = int((completed_days / total_days) * 100)

            return jsonify({
                "date": selected_date.isoformat(),
                "completed": True,
                "comment": comment,
                "photo_url": photo_url,
                "completed_days": completed_days,
                "total_days": total_days,
                "progress_percent": progress_percent
            })

    # Fetch all daily completions for the user, limit to next 66 days
    base_date = datetime.now().date()
    start_date = base_date
    response_all = supabase.table("daily_completions")\
        .select("*")\
        .eq("user_id", user["id"])\
        .gte("date", start_date.isoformat())\
        .order("date", desc=False)\
        .execute()
    # Convert date fields to string for template comparison
    completions = []
    if response_all.data:
        for c in response_all.data:
            c['date'] = c['date'].strftime('%Y-%m-%d') if hasattr(c['date'], 'strftime') else c['date']
            completions.append(c)

    # Find completion for selected_date
    completion = None
    if selected_date is not None:
        completion = next((c for c in completions if c["date"] == selected_date.isoformat()), None)

    # Calculate progress and streak info
    total_days = 66
    completed_days = len([c for c in completions if c["completed"]])
    progress_percent = int((completed_days / total_days) * 100)

    current_date = datetime.now().date()
    # Use the calculated start_date consistently (today)
    return render_template(
        "daily.html",
        completion=completion,
        completions=completions,
        profile=profile,
        selected_date=selected_date,
        total_days=total_days,
        completed_days=completed_days,
        progress_percent=progress_percent,
        timedelta=timedelta,
        current_date=current_date,
        start_date=start_date,
        user_id=user["id"]
    )

@app.route("/ranking")
def ranking():
    if not is_logged_in():
        return redirect(url_for("login"))
    user = session["user"]
    profile = None
    # Fetch profile data from Supabase
    response_profile = supabase.table("profiles").select("*").eq("user_id", user["id"]).execute()
    if response_profile.data and len(response_profile.data) > 0:
        profile = response_profile.data[0]

    # Fetch all profiles
    response_profiles = supabase.table("profiles").select("*").execute()
    profiles = response_profiles.data if response_profiles.data else []

    ranking = []
    for profile_item in profiles:
        user_id = profile_item.get("user_id")
        # Count completed daily_completions for this user
        response_count = supabase.table("daily_completions")\
            .select("id", count="exact")\
            .eq("user_id", user_id)\
            .eq("completed", True)\
            .execute()
        completions_count = response_count.count if response_count.count is not None else 0
        ranking.append({
            "user_id": user_id,
            "name": profile_item.get("name"),
            "activity": profile_item.get("activity"),
            "photo_url": profile_item.get("photo_url"),
            "completions": completions_count
        })

    # Sort ranking by completions descending
    ranking_sorted = sorted(ranking, key=lambda x: x["completions"], reverse=True)

    # No limit, show all users
    ranking_all = ranking_sorted

    return render_template("ranking.html", ranking=ranking_all, profile=profile)


@app.route("/daily/remove", methods=["POST"])
def daily_remove():
    if not is_logged_in():
        return jsonify({"success": False, "error": "Usuário não autenticado"}), 401
    user = session["user"]
    data = request.get_json()
    if not data or "date" not in data:
        return jsonify({"success": False, "error": "Data não fornecida"}), 400
    date_to_remove = data["date"]
    try:
        # Delete the daily completion for the user and date
        supabase.table("daily_completions")\
            .delete()\
            .eq("user_id", user["id"])\
            .eq("date", date_to_remove)\
            .execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
