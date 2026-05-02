const http = require('http')

const data = JSON.stringify({ to: '+13365925053' })

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/calls/outbound',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
}

const req = http.request(options, (res) => {
  let body = ''
  res.on('data', (chunk) => body += chunk)
  res.on('end', () => console.log('Response:', body))
})

req.on('error', (e) => console.error('Error:', e))
req.write(data)
req.end()