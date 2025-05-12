document.addEventListener('DOMContentLoaded', function() {
    // Armazena os dados das conclusões para uso posterior
    let completionsData = {};
    
    // Função para salvar os dados das conclusões no localStorage
    function saveCompletionsToStorage() {
        localStorage.setItem(`dailyCompletions_${currentUserId}`, JSON.stringify(completionsData));
    }
    
    // Função para carregar os dados das conclusões do localStorage
    function loadCompletionsFromStorage() {
        const storedCompletions = localStorage.getItem(`dailyCompletions_${currentUserId}`);
        if (storedCompletions) {
            completionsData = JSON.parse(storedCompletions);
        }
    }
    
    // Carregar dados do localStorage ao iniciar
    loadCompletionsFromStorage();
    
    // Popula os dados iniciais dos cards que estão marcados como concluídos
    document.querySelectorAll('.daily-card.completed').forEach(card => {
        const date = card.dataset.date;
        const photoPreview = card.querySelector('.photo-preview img');
        const commentPreview = card.querySelector('.comment-preview');
        
        let photoUrl = null;
        let comment = null;
        
        if (photoPreview) {
            photoUrl = photoPreview.src;
        }
        
        if (commentPreview) {
            // Extrai o texto do comentário sem o ícone
            const commentText = commentPreview.textContent.trim();
            comment = commentText;
        }
        
        // Salva os dados no objeto de completions
        completionsData[date] = {
            completed: true,
            photo_url: photoUrl,
            comment: comment,
            date: date
        };
    });
    
    // Salva os dados iniciais no localStorage
    saveCompletionsToStorage();
    
    // Função para atualizar o progresso na UI
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
    
    // Função para mostrar mensagem flash
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
            
            // Add close event
            flashMessage.querySelector('.close-flash').addEventListener('click', function() {
                flashMessage.remove();
            });
        } else {
            // Clear existing flash messages before adding new one
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
            
            // Add close event
            flashMessage.querySelector('.close-flash').addEventListener('click', function() {
                flashMessage.remove();
            });
        }
    }
    
    // Função para contar o número total de dias concluídos
    function countCompletedDays() {
        let count = 0;
        for (const date in completionsData) {
            if (completionsData[date].completed) {
                count++;
            }
        }
        return count;
    }
    
    // Função para atualizar um card para o estado não concluído
    function updateCardToIncomplete(date) {
        const card = document.querySelector(`.daily-card[data-date="${date}"]`);
        if (card) {
            // Atualiza classes do card
            card.classList.remove('completed');
            card.classList.add('missing');
            
            // Remove o badge de conclusão
            const badge = card.querySelector('.completion-badge');
            if (badge) {
                badge.remove();
            }
            
            // Atualiza o resumo da conclusão
            let summary = card.querySelector('.completion-summary');
            if (summary) {
                summary.innerHTML = '<i class="fas fa-times-circle"></i> Não concluído';
                summary.classList.add('no-completion');
            }
            
            // Atualiza o botão de edição
            const btnEdit = card.querySelector('.btn-edit');
            if (btnEdit) {
                btnEdit.innerHTML = '<i class="fas fa-plus"></i> Concluir';
            }
        }
    }
    
    // Manipulador de evento para o botão "Remover dos Concluídos"
    const btnRemoveCompletion = document.getElementById('btn-remove-completion');
    if (btnRemoveCompletion) {
        btnRemoveCompletion.addEventListener('click', function(event) {
            event.preventDefault();
            
            // Obtém a data atual da URL
            const urlParams = new URLSearchParams(window.location.search);
            const currentDate = urlParams.get('date');
            
            if (currentDate && completionsData[currentDate]) {
                // Remove os dados da conclusão do objeto de completions
                delete completionsData[currentDate];
                
                // Salva os dados atualizados no localStorage
                saveCompletionsToStorage();
                
                // Limpa os campos do formulário
                const commentField = document.getElementById('comment');
                if (commentField) {
                    commentField.value = '';
                }
                
                // Remove a prévia da foto atual
                const currentPhoto = document.querySelector('.current-photo');
                if (currentPhoto) {
                    currentPhoto.remove();
                }
                
                // Atualiza o card para não concluído
                updateCardToIncomplete(currentDate);
                
                // Atualiza o contador de dias concluídos
                const completedDays = countCompletedDays();
                const totalDays = document.querySelectorAll('.daily-card').length;
                
                // Atualiza a UI de progresso
                updateProgressUI(completedDays, totalDays);
                
                // Envia uma requisição AJAX para o backend para atualizar os dados no servidor
                fetch(`/daily/remove?date=${currentDate}`, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        date: currentDate
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Mostra mensagem de sucesso
                        showFlashMessage('Tarefa removida dos concluídos com sucesso!');
                        
                        // Atualiza a URL para remover o parâmetro de data
                        window.location.href = '/daily';
                    } else {
                        throw new Error('Resposta do servidor indica falha na remoção');
                    }
                })
                .catch(error => {
                    console.error('Erro na requisição:', error);
                    
                    // Mostra mensagem de erro
                    showFlashMessage('Erro ao remover a tarefa. Os dados foram removidos localmente, mas podem não ter sido sincronizados com o servidor.', true);
                    
                    // Mesmo com erro no servidor, mantém a interface atualizada
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
            
            // Extrair a data da URL do formulário
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
                    // Salva os dados da conclusão no objeto de completions
                    completionsData[data.date] = {
                        completed: true,
                        photo_url: data.photo_url || null,
                        comment: data.comment || null,
                        date: data.date
                    };
                    
                    // Salva os dados no localStorage
                    saveCompletionsToStorage();
                    
                    // Update the card for the day dynamically
                    const dayDate = data.date; // Assume que data.date vem no formato 'YYYY-MM-DD'
                    const comment = data.comment || '';
                    const photoUrl = data.photo_url;
    
                    // Find the card with matching date
                    const card = document.querySelector(`.daily-card[data-date="${dayDate}"]`);
                    if (card) {
                        // Update card classes
                        card.classList.remove('missing');
                        card.classList.add('completed');
    
                        // Update completion badge
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
    
                        // Update completion summary
                        let summary = card.querySelector('.completion-summary');
                        if (!summary) {
                            summary = document.createElement('div');
                            summary.classList.add('completion-summary');
                            card.insertBefore(summary, card.querySelector('.btn-edit'));
                        } else {
                            // Limpa o conteúdo atual
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
    
                        // Remove "no completion" message if present
                        const noCompletion = card.querySelector('.completion-summary.no-completion');
                        if (noCompletion) {
                            noCompletion.remove();
                        }
    
                        // Update the edit button text/icon
                        const btnEdit = card.querySelector('.btn-edit');
                        if (btnEdit) {
                            btnEdit.innerHTML = '<i class="fas fa-edit"></i> Editar';
                        }
                    }
    
                    // Atualizar a seção de progresso
                    updateProgressUI(data.completed_days, data.total_days);
    
                    // Reaplicar o filtro ativo
                    const activeFilter = document.querySelector('.filter-option.active');
                    if (activeFilter) {
                        activeFilter.click();
                    }
    
                    // Show a success flash message
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

    // Restore view and filter buttons functionality
    const viewOptions = document.querySelectorAll('.view-option');
    const filterOptions = document.querySelectorAll('.filter-option');
    const timelineGrid = document.getElementById('timeline-container');

    viewOptions.forEach(option => {
        option.addEventListener('click', function() {
            viewOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');

            const view = this.dataset.view;
            if (timelineGrid) {
                // Remove existing timeline- classes safely
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
    
    // Função para aplicar os dados das conclusões aos cards
    function applyCompletionsToCards() {
        for (const date in completionsData) {
            const completion = completionsData[date];
            if (completion.completed) {
                const card = document.querySelector(`.daily-card[data-date="${date}"]`);
                if (card) {
                    // Marca o card como concluído
                    card.classList.remove('missing');
                    card.classList.add('completed');
                    
                    // Adiciona o badge de conclusão se não existir
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
                    
                    // Atualiza o resumo da conclusão
                    let summary = card.querySelector('.completion-summary');
                    if (!summary) {
                        summary = document.createElement('div');
                        summary.classList.add('completion-summary');
                        card.insertBefore(summary, card.querySelector('.btn-edit'));
                    } else {
                        // Limpa o conteúdo atual
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
                    
                    // Atualiza o botão de edição
                    const btnEdit = card.querySelector('.btn-edit');
                    if (btnEdit) {
                        btnEdit.innerHTML = '<i class="fas fa-edit"></i> Editar';
                    }
                }
            }
        }
    }
    
    // Aplica os dados de conclusão após o carregamento da página
    applyCompletionsToCards();
    
    // Adiciona ouvintes para os botões de fechamento das mensagens flash
    document.querySelectorAll('.close-flash').forEach(button => {
        button.addEventListener('click', function() {
            this.closest('.flash-message').remove();
        });
    });

    // Image thumbnail preview on file upload
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