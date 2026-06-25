# Remote Control

Удалённое управление компьютером с телефона через GitHub.

## Как это работает

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Телефон   │────▶│  GitHub Pages    │     │     ПК      │
│  (браузер)  │     │  (интерфейс)     │     │  (агент)    │
└─────────────┘     └──────────────────┘     └──────┬──────┘
                                                    │
                     ┌──────────────────┐           │
                     │   Codespaces     │◀──────────┘
                     │   (сервер)       │
                     └──────────────────┘
```

## Быстрый старт

### Шаг 1: Создай репозиторий

1. Зайди на [github.com](https://github.com)
2. Нажми **New repository**
3. Назови `remote-control`
4. Сделай **Public**
5. Нажми **Create repository**

### Шаг 2: Загрузи код

Открой терминал в папке проекта:

```bash
cd remote-control
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/remote-control.git
git push -u origin main
```

### Шаг 3: Запусти сервер в Codespaces

1. Зайди в репозиторий на GitHub
2. Нажми зелёную кнопку **Code**
3. Выбери **Codespaces** → **Create codespace on main**
4. Подожди пока установится (автоматически)
5. Сервер запустится автоматически!

### Шаг 4: Открой интерфейс

1. В Codespaces нажми **Ports**
2. Нажми на значок globe рядом с портом 3000
3. Скопируй URL (вида `https://xxx-xxx.github.dev`)
4. Открой этот URL на телефоне

### Шаг 5: Запусти агента на ПК

На компьютере, которым хочешь управлять:

```bash
# Установи Node.js с https://nodejs.org

# Клонируй репозиторий
git clone https://github.com/YOUR_USERNAME/remote-control.git
cd remote-control

# Установи зависимости
npm install

# Запусти агент (замени URL на свой из Codespaces)
SERVER=https://xxx-xxx.github.dev TOKEN=remote-control-secret node agent.js
```

### Шаг 6: Управляй с телефона

1. Открой URL на телефоне
2. Введи адрес сервера (из Codespaces)
3. Нажми **Connect**
4. Выбери устройство
5. Управляй!

## Несколько устройств

На каждом ПК запусти агент с уникальным именем:

```bash
# ПК
SERVER=https://xxx-xxx.github.dev NAME="Desktop PC" node agent.js

# Ноутбук
SERVER=https://xxx-xxx.github.dev NAME="Laptop" node agent.js
```

Все устройства появятся в интерфейсе.

## Команды

| Кнопка | Действие |
|--------|----------|
| 📝 Notepad | Откроет Блокнот |
| 🔢 Calculator | Откроет Калькулятор |
| 🌐 Browser | Откроет URL в браузере |
| 🔒 Lock | Заблокирует компьютер |
| 📂 Apps | Покажет список программ |
| ⏻ Shutdown | Выключит компьютер |
| 🔄 Restart | Перезагрузит компьютер |

Также можно ввести любое приложение или команду вручную.

## Альтернатива: запуск без Codespaces

Если не хочешь Codespaces, можно запустить сервер на своём ПК:

```bash
# На ПК с статическим IP или через ngrok
npm install
node server/index.js

# Для доступа из интернета используй ngrok
npx ngrok http 3000
```

## Безопасность

- Токен по умолчанию: `remote-control-secret`
- Измени его в `.env` или передай через переменную окружения
- Для продакшена добавь HTTPS

## Структура

```
remote-control/
├── server/index.js    - Сервер
├── agent.js           - Агент (запускается на ПК)
├── public/index.html  - Веб-интерфейс
├── .github/workflows/ - Автодеплой на Pages
└── .devcontainer/     - Конфигурация Codespaces
```

## License

MIT
