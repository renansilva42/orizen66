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
        activity = request.form.get("activity")
        photo = request.files.get("photo")
        photo_url = None
        if photo:
            photo_url = upload_file_to_supabase_storage(photo, "profile-photos")
        # Salve ou atualize o perfil do usuário no Supabase
        data = {
            "user_id": user["id"],
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
    completion = None
    if request.method == "POST":
        comment = request.form.get("comment")
        photo = request.files.get("photo")
        photo_url = None
        if photo:
            photo_url = upload_file_to_supabase_storage(photo, "daily-photos")
        data = {
            "user_id": user["id"],
            "completed": True,
            "comment": comment,
            "photo_url": photo_url,
            "date": datetime.now().date().isoformat()
        }
        # Upsert daily completion with unique constraint on user_id and date
        supabase.table("daily_completions").upsert(data, on_conflict=["user_id", "date"]).execute()
    # Fetch daily completion data from Supabase for today
    today = datetime.now().date().isoformat()
    response = supabase.table("daily_completions").select("*").eq("user_id", user["id"]).eq("date", today).execute()
    if response.data and len(response.data) > 0:
        completion = response.data[0]
    return render_template("daily.html", completion=completion, profile=profile)

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
    # Fetch top 10 users by count of completed days
    query = """
    SELECT p.user_id, p.activity, p.photo_url, COUNT(dc.completed) as completions
    FROM profiles p
    LEFT JOIN daily_completions dc ON p.user_id = dc.user_id AND dc.completed = TRUE
    GROUP BY p.user_id, p.activity, p.photo_url
    ORDER BY completions DESC
    LIMIT 10;
    """
    try:
        response = supabase.rpc("execute_sql", {"query": query}).execute()
        ranking = response.data if response.data else []
    except Exception as e:
        print(f"Error fetching ranking data: {e}")
        ranking = []
    return render_template("ranking.html", ranking=ranking, profile=profile)


if __name__ == "__main__":
    app.run(debug=True)
