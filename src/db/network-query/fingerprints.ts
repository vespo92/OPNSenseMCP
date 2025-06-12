// Device Fingerprint Database - MAC OUI Prefixes and Patterns
export const deviceFingerprintData = [
  // Gaming Consoles
  { macPrefix: '7C:BB:8A', manufacturer: 'Nintendo', deviceType: 'gaming_console', commonModels: ['Nintendo Switch'] },
  { macPrefix: '0C:FE:45', manufacturer: 'Nintendo', deviceType: 'gaming_console', commonModels: ['Nintendo Switch'] },
  { macPrefix: '98:B6:E9', manufacturer: 'Nintendo', deviceType: 'gaming_console', commonModels: ['Nintendo Switch'] },
  { macPrefix: '00:1B:EA', manufacturer: 'Nintendo', deviceType: 'gaming_console', commonModels: ['Nintendo 3DS', 'Wii U'] },
  { macPrefix: '00:09:BF', manufacturer: 'Nintendo', deviceType: 'gaming_console', commonModels: ['Nintendo Wii', 'DS'] },
  
  { macPrefix: '00:D9:D1', manufacturer: 'Sony', deviceType: 'gaming_console', commonModels: ['PlayStation 5'] },
  { macPrefix: '28:3F:69', manufacturer: 'Sony', deviceType: 'gaming_console', commonModels: ['PlayStation 5'] },
  { macPrefix: 'F8:46:1C', manufacturer: 'Sony', deviceType: 'gaming_console', commonModels: ['PlayStation 4'] },
  { macPrefix: '00:41:5D', manufacturer: 'Sony', deviceType: 'gaming_console', commonModels: ['PlayStation 4'] },
  { macPrefix: 'AC:B5:7D', manufacturer: 'Sony', deviceType: 'gaming_console', commonModels: ['PlayStation 5'] },
  
  { macPrefix: '7C:ED:8D', manufacturer: 'Microsoft', deviceType: 'gaming_console', commonModels: ['Xbox One'] },
  { macPrefix: '60:45:BD', manufacturer: 'Microsoft', deviceType: 'gaming_console', commonModels: ['Xbox Series X/S'] },
  { macPrefix: '94:9A:A9', manufacturer: 'Microsoft', deviceType: 'gaming_console', commonModels: ['Xbox Series X/S'] },
  { macPrefix: '98:5F:D3', manufacturer: 'Microsoft', deviceType: 'gaming_console', commonModels: ['Xbox Series X/S'] },
  
  // Apple Devices
  { macPrefix: 'A8:51:6B', manufacturer: 'Apple', deviceType: 'phone', commonModels: ['iPhone'] },
  { macPrefix: '90:3C:92', manufacturer: 'Apple', deviceType: 'phone', commonModels: ['iPhone'] },
  { macPrefix: 'BC:3A:EA', manufacturer: 'Apple', deviceType: 'phone', commonModels: ['iPhone'] },
  { macPrefix: '3C:E0:72', manufacturer: 'Apple', deviceType: 'phone', commonModels: ['iPhone'] },
  { macPrefix: 'DC:2B:2A', manufacturer: 'Apple', deviceType: 'tablet', commonModels: ['iPad'] },
  { macPrefix: 'A4:D1:8C', manufacturer: 'Apple', deviceType: 'tablet', commonModels: ['iPad'] },
  { macPrefix: 'F0:DB:F8', manufacturer: 'Apple', deviceType: 'computer', commonModels: ['MacBook'] },
  { macPrefix: '14:7D:DA', manufacturer: 'Apple', deviceType: 'computer', commonModels: ['MacBook'] },
  { macPrefix: 'D0:E1:40', manufacturer: 'Apple', deviceType: 'smart_tv', commonModels: ['Apple TV'] },
  { macPrefix: '9C:20:7B', manufacturer: 'Apple', deviceType: 'smart_tv', commonModels: ['Apple TV'] },
  
  // Samsung Devices
  { macPrefix: 'A0:CC:2B', manufacturer: 'Samsung', deviceType: 'phone', commonModels: ['Galaxy S', 'Galaxy Note'] },
  { macPrefix: '40:5B:D8', manufacturer: 'Samsung', deviceType: 'phone', commonModels: ['Galaxy S', 'Galaxy A'] },
  { macPrefix: '8C:F5:A3', manufacturer: 'Samsung', deviceType: 'phone', commonModels: ['Galaxy S', 'Galaxy Z'] },
  { macPrefix: 'BC:20:BA', manufacturer: 'Samsung', deviceType: 'tablet', commonModels: ['Galaxy Tab'] },
  { macPrefix: 'E4:B0:21', manufacturer: 'Samsung', deviceType: 'smart_tv', commonModels: ['Samsung Smart TV'] },
  { macPrefix: '00:7C:2D', manufacturer: 'Samsung', deviceType: 'smart_tv', commonModels: ['Samsung Smart TV'] },
  
  // Smart Home & IoT
  { macPrefix: '68:C6:3A', manufacturer: 'Amazon', deviceType: 'smart_speaker', commonModels: ['Echo', 'Echo Dot'] },
  { macPrefix: 'A4:08:EA', manufacturer: 'Amazon', deviceType: 'smart_speaker', commonModels: ['Echo', 'Alexa'] },
  { macPrefix: 'FC:A1:83', manufacturer: 'Amazon', deviceType: 'smart_speaker', commonModels: ['Echo Show'] },
  { macPrefix: '84:D6:D0', manufacturer: 'Amazon', deviceType: 'media_player', commonModels: ['Fire TV'] },
  { macPrefix: '10:AE:60', manufacturer: 'Amazon', deviceType: 'media_player', commonModels: ['Fire TV Stick'] },
  
  { macPrefix: '30:8C:FB', manufacturer: 'Google', deviceType: 'smart_speaker', commonModels: ['Google Home'] },
  { macPrefix: 'E4:F0:42', manufacturer: 'Google', deviceType: 'smart_speaker', commonModels: ['Google Home Mini'] },
  { macPrefix: '48:D6:D5', manufacturer: 'Google', deviceType: 'smart_speaker', commonModels: ['Google Nest Hub'] },
  { macPrefix: '1C:F2:9A', manufacturer: 'Google', deviceType: 'media_player', commonModels: ['Chromecast'] },
  { macPrefix: '6C:AD:F8', manufacturer: 'Google', deviceType: 'media_player', commonModels: ['Chromecast'] },
  
  // Streaming Devices
  { macPrefix: 'B0:A7:37', manufacturer: 'Roku', deviceType: 'media_player', commonModels: ['Roku Streaming Stick'] },
  { macPrefix: 'CC:6D:A0', manufacturer: 'Roku', deviceType: 'media_player', commonModels: ['Roku Ultra'] },
  { macPrefix: 'D4:E2:2F', manufacturer: 'Roku', deviceType: 'media_player', commonModels: ['Roku TV'] },
  
  // Smart Home Brands
  { macPrefix: 'D0:73:D5', manufacturer: 'TP-Link', deviceType: 'smart_home', commonModels: ['Kasa Smart Plug', 'Kasa Smart Switch'] },
  { macPrefix: '50:C7:BF', manufacturer: 'TP-Link', deviceType: 'smart_home', commonModels: ['Kasa Smart Bulb'] },
  { macPrefix: 'B4:E6:2D', manufacturer: 'Philips', deviceType: 'smart_home', commonModels: ['Hue Bridge', 'Hue Bulb'] },
  { macPrefix: '00:17:88', manufacturer: 'Philips', deviceType: 'smart_home', commonModels: ['Hue'] },
  { macPrefix: 'E0:4F:BD', manufacturer: 'WeMo', deviceType: 'smart_home', commonModels: ['WeMo Switch', 'WeMo Plug'] },
  
  // Cameras
  { macPrefix: 'BC:DD:C2', manufacturer: 'Wyze', deviceType: 'camera', commonModels: ['Wyze Cam'] },
  { macPrefix: '2C:AA:8E', manufacturer: 'Wyze', deviceType: 'camera', commonModels: ['Wyze Cam v3'] },
  { macPrefix: '00:62:6E', manufacturer: 'Nest', deviceType: 'camera', commonModels: ['Nest Cam'] },
  { macPrefix: '18:B4:30', manufacturer: 'Nest', deviceType: 'smart_home', commonModels: ['Nest Thermostat'] },
  { macPrefix: '00:18:DD', manufacturer: 'Ring', deviceType: 'camera', commonModels: ['Ring Doorbell'] },
  { macPrefix: 'B0:09:DA', manufacturer: 'Ring', deviceType: 'camera', commonModels: ['Ring Camera'] },
  
  // Computers & NAS
  { macPrefix: '00:11:32', manufacturer: 'Synology', deviceType: 'nas', commonModels: ['DiskStation'] },
  { macPrefix: '00:08:9B', manufacturer: 'QNAP', deviceType: 'nas', commonModels: ['QNAP NAS'] },
  { macPrefix: '00:D0:4B', manufacturer: 'Western Digital', deviceType: 'nas', commonModels: ['My Cloud'] },
  
  // Printers
  { macPrefix: '00:00:48', manufacturer: 'HP', deviceType: 'printer', commonModels: ['HP Printer'] },
  { macPrefix: '00:1B:A9', manufacturer: 'Brother', deviceType: 'printer', commonModels: ['Brother Printer'] },
  { macPrefix: '00:00:F0', manufacturer: 'Canon', deviceType: 'printer', commonModels: ['Canon Printer'] },
  { macPrefix: '00:26:AB', manufacturer: 'Epson', deviceType: 'printer', commonModels: ['Epson Printer'] }
];

// Hostname Patterns for Device Identification
export const hostnamePatternData = [
  // Gaming Consoles
  { pattern: '^nintendo.*switch', deviceType: 'gaming_console', description: 'Nintendo Switch', priority: 10 },
  { pattern: '^switch-[a-f0-9]{4}', deviceType: 'gaming_console', description: 'Nintendo Switch', priority: 10 },
  { pattern: '^playstation.*5', deviceType: 'gaming_console', description: 'PlayStation 5', priority: 10 },
  { pattern: '^ps5-[a-f0-9]{4}', deviceType: 'gaming_console', description: 'PlayStation 5', priority: 10 },
  { pattern: '^xbox.*series', deviceType: 'gaming_console', description: 'Xbox Series X/S', priority: 10 },
  { pattern: '^xboxone', deviceType: 'gaming_console', description: 'Xbox One', priority: 10 },
  
  // Apple Devices
  { pattern: '^.*iphone.*', deviceType: 'phone', description: 'iPhone', priority: 9 },
  { pattern: '^.*ipad.*', deviceType: 'tablet', description: 'iPad', priority: 9 },
  { pattern: '^.*macbook.*', deviceType: 'computer', description: 'MacBook', priority: 9 },
  { pattern: '^.*imac.*', deviceType: 'computer', description: 'iMac', priority: 9 },
  { pattern: '^.*apple.*tv.*', deviceType: 'smart_tv', description: 'Apple TV', priority: 9 },
  
  // Smart Home
  { pattern: '^echo-.*', deviceType: 'smart_speaker', description: 'Amazon Echo', priority: 8 },
  { pattern: '^alexa-.*', deviceType: 'smart_speaker', description: 'Amazon Alexa', priority: 8 },
  { pattern: '^google-home.*', deviceType: 'smart_speaker', description: 'Google Home', priority: 8 },
  { pattern: '^chromecast.*', deviceType: 'media_player', description: 'Chromecast', priority: 8 },
  { pattern: '^roku.*', deviceType: 'media_player', description: 'Roku', priority: 8 },
  
  // Generic Patterns
  { pattern: '.*-pc$', deviceType: 'computer', description: 'Windows PC', priority: 5 },
  { pattern: '.*-laptop$', deviceType: 'computer', description: 'Laptop', priority: 5 },
  { pattern: '^android-.*', deviceType: 'phone', description: 'Android Phone', priority: 5 },
  { pattern: '.*galaxy.*', deviceType: 'phone', description: 'Samsung Galaxy', priority: 6 },
  { pattern: '^nas-.*', deviceType: 'nas', description: 'Network Storage', priority: 7 },
  { pattern: '.*printer.*', deviceType: 'printer', description: 'Printer', priority: 6 }
];