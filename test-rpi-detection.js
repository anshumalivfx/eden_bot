const os = require('os');

console.log('🍓 Raspberry Pi Detection Test\n');

const arch = os.arch();
const platform = os.platform();
const isRaspberryPi = arch === 'arm' || arch === 'arm64';

console.log('System Information:');
console.log('  Architecture:', arch);
console.log('  Platform:', platform);
console.log('  Is Raspberry Pi:', isRaspberryPi ? '✅ YES' : '❌ NO');
console.log('  CPU Model:', os.cpus()[0].model);
console.log('  Total Memory:', (os.totalmem() / 1024 / 1024 / 1024).toFixed(2), 'GB');
console.log('  Free Memory:', (os.freemem() / 1024 / 1024 / 1024).toFixed(2), 'GB');

console.log('\nOptimizations:');
if (isRaspberryPi) {
  console.log('  ✅ Raspberry Pi optimizations will be applied');
  console.log('  ✅ Extended timeouts: 2-3 minutes');
  console.log('  ✅ Additional browser flags for stability');
  console.log('  ✅ Automatic retry logic enabled');
  console.log('\nRecommendations:');
  console.log('  📌 Make sure Chromium is installed: sudo apt-get install chromium-browser');
  console.log('  📌 Increase swap space to 1024MB or higher');
  console.log('  📌 Use: ./start-rpi.sh to start Eden with optimal settings');
} else {
  console.log('  ℹ️  Standard configuration will be used');
  console.log('  ℹ️  Standard timeouts: 1-2 minutes');
}

console.log('\n✅ Detection test complete!');
