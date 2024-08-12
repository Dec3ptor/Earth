const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/himawari', createProxyMiddleware({
  target: 'https://www.data.jma.go.jp',
  changeOrigin: true,
  pathRewrite: {
    '^/himawari': '/mscweb/data/himawari'
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
  }
}));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Proxy server is running on http://localhost:${PORT}`);
});
