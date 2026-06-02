const dns = require('dns');
console.log('running dns-check');
dns.resolve('www.youtube.com', (err, res) => {
    if (err) {
        console.log('dns.err:', err.message);
    } else {
        console.log('dns.res:', res.join(', '));
    }
});
setTimeout(() => process.exit(0), 4000);
