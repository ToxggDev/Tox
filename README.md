# Tox - Crypto Contract Address Sharer

Tox is a Chrome extension that makes it easy to share crypto contract addresses with your team or community. It automatically detects contract addresses from your clipboard or web pages and shares them through Discord or your private group.

## Features

- 🔍 Automatic contract address detection (Ethereum, TRON, Bitcoin)
- 📋 Clipboard monitoring with toggle
- 🎯 One-click sharing from supported websites
- 💬 Discord webhook integration
- 👥 Private group sharing
- 📊 Activity history
- 🎨 Clean, modern UI

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Configuration

1. Click the Tox icon in your Chrome toolbar
2. Click the settings button
3. Configure your:
   - Discord webhook URL
   - Group settings
   - User preferences

## Usage

### Automatic Clipboard Detection
1. Copy any contract address to your clipboard
2. Tox will automatically detect and share it

### Manual Sharing
1. Visit a supported website (e.g., pump.fun, dexscreener.com)
2. Click the "Share CA" button that appears
3. The contract address will be shared with your configured channels

## Supported Websites
- pump.fun
- dexscreener.com
- (More coming soon)

## Development

### Project Structure
```
tox/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── styles/
│   └── popup.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Building
No build step required. The extension can be loaded directly into Chrome.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
MIT 