document.addEventListener('DOMContentLoaded', function() {
    // Armazena os dados das conclusões para uso posterior
    let completionsData = {};

    // Inicializa completionsData a partir dos dados embutidos no template
    if (window.initialCompletionsData) {
        window.initialCompletionsData.forEach(c => {
            completionsData[c.date] = {
                completed: c.completed,
                photo_url: c.photo_url || null,
                comment: c.comment || null,
                date: c.date
            };
        });
    }

    // Salva os dados das conclusões no localStorage
    function saveCompletionsToStorage() {
        localStorage.setItem(`dailyCompletions_${currentUserId}`, JSON.stringify(completionsData));
    }

    // Atualiza o progresso na UI
    function updateProgressUI(completedDays, totalDays) {
        const progressPercent = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

        const progressStats = document.querySelector('.progress-stats');
        const progressNumber = document.querySelector('.progress-number');
        const progressFill = document.querySelector('.progress-fill');
        const progressPercentage = document.querySelector('.progress-percentage');

        if (progressStats && progressNumber && progressFill && progressPercentage) {
            progressNumber.textContent = completedDays;
            progressStats.innerHTML = `<span class="progress-number">${completedDays}</span> / ${totalDays} dias concluídos`;
            progressFill.style.width = `${progressPercent}%`;
            progressPercentage.textContent = `${progressPercent}%`;
        }
    }

    // Mostrar mensagem flash
    function showFlashMessage(message, isError = false) {
        const flashContainer = document.querySelector('.flash-container');
        if (!flashContainer) {
            const newFlashContainer = document.createElement('div');
            newFlashContainer.classList.add('flash-container');
            document.querySelector('.progress-section').insertAdjacentElement('beforebegin', newFlashContainer);

            const flashMessage = document.createElement('div');
            flashMessage.classList.add('flash-message');

            if (isError) {
                flashMessage.style.borderLeftColor = 'var(--danger)';
                flashMessage.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
                flashMessage.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message} <button class="close-flash">×</button>`;
            } else {
                flashMessage.innerHTML = `<i class="fas fa-check-circle"></i> ${message} <button class="close-flash">×</button>`;
            }

            newFlashContainer.appendChild(flashMessage);

            flashMessage.querySelector('.close-flash').addEventListener('click', function() {
                flashMessage.remove();
            });
        } else {
            flashContainer.innerHTML = '';
            const flashMessage = document.createElement('div');
            flashMessage.classList.add('flash-message');

            if (isError) {
                flashMessage.style.borderLeftColor = 'var(--danger)';
                flashMessage.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
                flashMessage.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message} <button class="close-flash">×</button>`;
            } else {
                flashMessage.innerHTML = `<i class="fas fa-check-circle"></i> ${message} <button class="close-flash">×</button>`;
            }

            flashContainer.appendChild(flashMessage);

            flashMessage.querySelector('.close-flash').addEventListener('click', function() {
                flashMessage.remove();
            });
        }
    }

    // Contar dias concluídos
    function countCompletedDays() {
        let count = 0;
        for (const date in completionsData) {
            if (completionsData[date].completed) {
                count++;
            }
        }
        return count;
    }

    // Atualizar card para estado não concluído
    function updateCardToIncomplete(date) {
        const card = document.querySelector(`.daily-card[data-date="${date}"]`);
        if (card) {
            card.classList.remove('completed');
            card.classList.add('missing');

            const badge = card.querySelector('.completion-badge');
            if (badge) {
                badge.remove();
            }

            let summary = card.querySelector('.completion-summary');
            if (summary) {
                summary.innerHTML = '<i class="fas fa-times-circle"></i> Não concluído';
                summary.classList.add('no-completion');
            }

            const btnEdit = card.querySelector('.btn-edit');
            if (btnEdit) {
                btnEdit.innerHTML = '<i class="fas fa-plus"></i> Concluir';
            }
        }
    }

    // Botão remover conclusão
    const btnRemoveCompletion = document.getElementById('btn-remove-completion');
    if (btnRemoveCompletion) {
        btnRemoveCompletion.addEventListener('click', function(event) {
            event.preventDefault();

            const urlParams = new URLSearchParams(window.location.search);
            const currentDate = urlParams.get('date');

            if (currentDate && completionsData[currentDate]) {
                delete completionsData[currentDate];
                saveCompletionsToStorage();

                const commentField = document.getElementById('comment');
                if (commentField) {
                    commentField.value = '';
                }

                const currentPhoto = document.querySelector('.current-photo');
                if (currentPhoto) {
                    currentPhoto.remove();
                }

                updateCardToIncomplete(currentDate);

                const completedDays = countCompletedDays();
                const totalDays = document.querySelectorAll('.daily-card').length;

                updateProgressUI(completedDays, totalDays);

                fetch(`/daily/remove?date=${currentDate}`, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ date: currentDate })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showFlashMessage('Tarefa removida dos concluídos com sucesso!');
                        window.location.href = '/daily';
                    } else {
                        throw new Error('Resposta do servidor indica falha na remoção');
                    }
                })
                .catch(error => {
                    console.error('Erro na requisição:', error);
                    showFlashMessage('Erro ao remover a tarefa. Os dados foram removidos localmente, mas podem não ter sido sincronizados com o servidor.', true);
                    window.location.href = '/daily';
                });
            }
        });
    }

    const dailyForm = document.getElementById('daily-form');
    if (dailyForm) {
        dailyForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData(dailyForm);
            const actionUrl = dailyForm.getAttribute('action');

            const urlParams = new URLSearchParams(actionUrl.split('?')[1]);
            const currentDate = urlParams.get('date');

            fetch(actionUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.completed) {
                    completionsData[data.date] = {
                        completed: true,
                        photo_url: data.photo_url || null,
                        comment: data.comment || null,
                        date: data.date
                    };

                    saveCompletionsToStorage();

                    const dayDate = data.date;
                    const comment = data.comment || '';
                    const photoUrl = data.photo_url;

                    const card = document.querySelector(`.daily-card[data-date="${dayDate}"]`);
                    if (card) {
                        card.classList.remove('missing');
                        card.classList.add('completed');

                        let badge = card.querySelector('.completion-badge');
                        if (!badge) {
                            badge = document.createElement('div');
                            badge.classList.add('completion-badge');
                            badge.innerHTML = '<i class="fas fa-check-circle"></i>';
                            const dayHeader = card.querySelector('.day-header');
                            if (dayHeader) {
                                dayHeader.appendChild(badge);
                            }
                        }

                        let summary = card.querySelector('.completion-summary');
                        if (!summary) {
                            summary = document.createElement('div');
                            summary.classList.add('completion-summary');
                            card.insertBefore(summary, card.querySelector('.btn-edit'));
                        } else {
                            summary.innerHTML = '';
                            summary.classList.remove('no-completion');
                        }

                        if (photoUrl) {
                            const photoDiv = document.createElement('div');
                            photoDiv.classList.add('photo-preview');
                            const img = document.createElement('img');
                            img.src = photoUrl;
                            img.alt = `Foto do dia ${card.querySelector('.day-number').textContent}`;
                            img.classList.add('daily-photo-thumb');
                            photoDiv.appendChild(img);
                            summary.appendChild(photoDiv);
                        }

                        if (comment) {
                            const commentDiv = document.createElement('div');
                            commentDiv.classList.add('comment-preview');
                            commentDiv.innerHTML = `<i class="fas fa-quote-left"></i> ${comment.length > 50 ? comment.substring(0, 50) + '...' : comment}`;
                            summary.appendChild(commentDiv);
                        }

                        const noCompletion = card.querySelector('.completion-summary.no-completion');
                        if (noCompletion) {
                            noCompletion.remove();
                        }

                        const btnEdit = card.querySelector('.btn-edit');
                        if (btnEdit) {
                            btnEdit.innerHTML = '<i class="fas fa-edit"></i> Editar';
                        }
                    }

                    updateProgressUI(data.completed_days, data.total_days);

                    const activeFilter = document.querySelector('.filter-option.active');
                    if (activeFilter) {
                        activeFilter.click();
                    }

                    showFlashMessage('Tarefa diária salva com sucesso!');
                } else {
                    throw new Error('Resposta do servidor indica falha na conclusão');
                }
            })
            .catch(error => {
                console.error('Erro na requisição:', error);
                showFlashMessage('Erro ao salvar a tarefa diária. Tente novamente.', true);
            });
        });
    }

    const viewOptions = document.querySelectorAll('.view-option');
    const filterOptions = document.querySelectorAll('.filter-option');
    const timelineGrid = document.getElementById('timeline-container');

    viewOptions.forEach(option => {
        option.addEventListener('click', function() {
            viewOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');

            const view = this.dataset.view;
            if (timelineGrid) {
                Array.from(timelineGrid.classList).forEach(cls => {
                    if (cls.startsWith('timeline-')) {
                        timelineGrid.classList.remove(cls);
                    }
                });
                timelineGrid.classList.add('timeline-' + view);
            }
        });
    });

    filterOptions.forEach(option => {
        option.addEventListener('click', function() {
            filterOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');

            const filter = this.dataset.filter;
            if (timelineGrid) {
                timelineGrid.classList.remove('filter-all', 'filter-completed', 'filter-missing');
                timelineGrid.classList.add('filter-' + filter);
            }
        });
    });

    function applyCompletionsToCards() {
        for (const date in completionsData) {
            const completion = completionsData[date];
            if (completion.completed) {
                const card = document.querySelector(`.daily-card[data-date="${date}"]`);
                if (card) {
                    card.classList.remove('missing');
                    card.classList.add('completed');

                    let badge = card.querySelector('.completion-badge');
                    if (!badge) {
                        badge = document.createElement('div');
                        badge.classList.add('completion-badge');
                        badge.innerHTML = '<i class="fas fa-check-circle"></i>';
                        const dayHeader = card.querySelector('.day-header');
                        if (dayHeader) {
                            dayHeader.appendChild(badge);
                        }
                    }

                    let summary = card.querySelector('.completion-summary');
                    if (!summary) {
                        summary = document.createElement('div');
                        summary.classList.add('completion-summary');
                        card.insertBefore(summary, card.querySelector('.btn-edit'));
                    } else {
                        summary.innerHTML = '';
                        summary.classList.remove('no-completion');
                    }

                    if (completion.photo_url) {
                        const photoDiv = document.createElement('div');
                        photoDiv.classList.add('photo-preview');
                        const img = document.createElement('img');
                        img.src = completion.photo_url;
                        img.alt = `Foto do dia ${card.querySelector('.day-number').textContent}`;
                        img.classList.add('daily-photo-thumb');
                        photoDiv.appendChild(img);
                        summary.appendChild(photoDiv);
                    }

                    if (completion.comment) {
                        const commentDiv = document.createElement('div');
                        commentDiv.classList.add('comment-preview');
                        commentDiv.innerHTML = `<i class="fas fa-quote-left"></i> ${completion.comment.length > 50 ? completion.comment.substring(0, 50) + '...' : completion.comment}`;
                        summary.appendChild(commentDiv);
                    }

                    const btnEdit = card.querySelector('.btn-edit');
                    if (btnEdit) {
                        btnEdit.innerHTML = '<i class="fas fa-edit"></i> Editar';
                    }
                }
            }
        }
    }

    applyCompletionsToCards();

    document.querySelectorAll('.close-flash').forEach(button => {
        button.addEventListener('click', function() {
            this.closest('.flash-message').remove();
        });
    });

    const photoInput = document.getElementById('photo');
    const filePreviewContainer = document.querySelector('.file-preview');

    if (photoInput && filePreviewContainer) {
        photoInput.addEventListener('change', function(event) {
            filePreviewContainer.innerHTML = '';

            const file = event.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = 'Pré-visualização da imagem';
                    img.style.maxWidth = '150px';
                    img.style.maxHeight = '150px';
                    img.style.borderRadius = '8px';
                    img.style.marginTop = '10px';
                    filePreviewContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }
});
