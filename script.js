// Класс для работы с Интеллектуальным помощником
class IntelligentAssistant {
    constructor() {
        this.apiUrl = 'http://localhost:11434/api/generate'; // Ollama API endpoint
        this.chatHistory = [];
        this.isLoading = false;

        // DOM элементы
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-button');
        this.chatMessages = document.getElementById('chat-messages');
        this.errorMessage = document.getElementById('error-message');
        this.loadingIndicator = document.getElementById('loading');

        // Элементы настроек
        this.temperatureInput = document.getElementById('temperature');
        this.tempValue = document.getElementById('temp-value');
        this.maxTokensInput = document.getElementById('max-tokens');
        this.modelSelect = document.getElementById('model-select');

        this.init();
    }

    // Инициализация приложения
    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.loadChatHistory();
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Отправка сообщения
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Обновление отображения температуры
        this.temperatureInput.addEventListener('input', () => {
            this.tempValue.textContent = this.temperatureInput.value;
        });

        // Сохранение настроек при изменении
        this.temperatureInput.addEventListener('change', () => this.saveSettings());
        this.maxTokensInput.addEventListener('change', () => this.saveSettings());
        this.modelSelect.addEventListener('change', () => this.saveSettings());
    }

    // Отправка сообщения в Ollama
    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message || this.isLoading) return;

        // Очищаем поле ввода и добавляем сообщение пользователя
        this.userInput.value = '';
        this.addMessage('user', message);
        this.setLoading(true);
        this.hideError();

        try {
            const response = await this.callOllamaAPI(message);
            this.addMessage('assistant', response);
        } catch (error) {
            this.showError(`Ошибка при получении ответа: ${error.message}`);
            console.error('API Error:', error);
        } finally {
            this.setLoading(false);
        }
    }

    // Вызов Ollama API
    async callOllamaAPI(prompt) {
        const requestBody = {
            model: this.modelSelect.value,
            prompt: prompt,
            stream: false,
            options: {
                temperature: parseFloat(this.temperatureInput.value),
                num_predict: parseInt(this.maxTokensInput.value)
            }
        };

        // Добавляем контекст предыдущих сообщений для лучшего понимания
        if (this.chatHistory.length > 0) {
            requestBody.prompt = this.buildContextPrompt(prompt);
        }

        console.log('Отправка запроса к Ollama:', requestBody);

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Сохраняем в историю
        this.chatHistory.push({ role: 'user', content: prompt });
        this.chatHistory.push({ role: 'assistant', content: data.response });
        this.saveChatHistory();

        return data.response;
    }

    // Построение контекста для лучшего понимания модели
    buildContextPrompt(currentPrompt) {
        const recentMessages = this.chatHistory.slice(-6); // Последние 3 пары сообщений
        let context = '';

        for (const msg of recentMessages) {
            if (msg.role === 'user') {
                context += `Пользователь: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
                context += `Помощник: ${msg.content}\n`;
            }
        }

        context += `Пользователь: ${currentPrompt}\nПомощник:`;
        return context;
    }

    // Добавление сообщения в чат
    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Форматируем контент (простая обработка markdown-like синтаксиса)
        contentDiv.innerHTML = this.formatMessage(content);
        messageDiv.appendChild(contentDiv);

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    // Простое форматирование сообщений
    formatMessage(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // *italic*
            .replace(/```(.*?)```/gs, '<code>$1</code>') // ```code```
            .replace(/`(.*?)`/g, '<code>$1</code>') // `code`
            .replace(/\n/g, '<br>'); // переносы строк
    }

    // Управление состоянием загрузки
    setLoading(loading) {
        this.isLoading = loading;
        this.sendButton.disabled = loading;
        this.userInput.disabled = loading;
        this.loadingIndicator.style.display = loading ? 'flex' : 'none';
    }

    // Показ ошибки
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        setTimeout(() => this.hideError(), 5000); // Автоскрытие через 5 секунд
    }

    // Скрытие ошибки
    hideError() {
        this.errorMessage.style.display = 'none';
    }

    // Прокрутка чата вниз
    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    // Сохранение настроек в localStorage
    saveSettings() {
        const settings = {
            temperature: this.temperatureInput.value,
            maxTokens: this.maxTokensInput.value,
            model: this.modelSelect.value
        };
        localStorage.setItem('assistant-settings', JSON.stringify(settings));
    }

    // Загрузка настроек из localStorage
    loadSettings() {
        const settings = localStorage.getItem('assistant-settings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.temperatureInput.value = parsed.temperature || 0.7;
            this.maxTokensInput.value = parsed.maxTokens || 500;
            this.modelSelect.value = parsed.model || 'gemma3:1b';
            this.tempValue.textContent = this.temperatureInput.value;
        }
    }

    // Сохранение истории чата
    saveChatHistory() {
        // Сохраняем только последние 50 сообщений для экономии места
        const recentHistory = this.chatHistory.slice(-50);
        localStorage.setItem('assistant-chat-history', JSON.stringify(recentHistory));
    }

    // Загрузка истории чата
    loadChatHistory() {
        const history = localStorage.getItem('assistant-chat-history');
        if (history) {
            this.chatHistory = JSON.parse(history);
            // Восстанавливаем сообщения в UI
            this.chatHistory.forEach(msg => {
                this.addMessage(msg.role, msg.content);
            });
        }
    }

    // Очистка истории чата
    clearHistory() {
        this.chatHistory = [];
        this.chatMessages.innerHTML = '';
        localStorage.removeItem('assistant-chat-history');
        // Добавляем приветственное сообщение
        this.addMessage('system', 'История чата очищена. Привет! Я ваш интеллектуальный помощник. Задайте мне любой вопрос, и я постараюсь помочь вам.');
    }
}

// Проверка доступности Ollama API
async function checkOllamaConnection() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем подключение к Ollama
    const isConnected = await checkOllamaConnection();
    if (!isConnected) {
        const assistant = new IntelligentAssistant();
        assistant.showError('Не удалось подключиться к Ollama. Убедитесь, что Ollama запущен и доступен по адресу http://localhost:11434');
    } else {
        // Инициализируем приложение
        window.assistant = new IntelligentAssistant();
    }
});

// Экспорт функций для использования в консоли разработчика
window.clearChatHistory = () => {
    if (window.assistant) {
        window.assistant.clearHistory();
    }
};

window.checkConnection = checkOllamaConnection;
