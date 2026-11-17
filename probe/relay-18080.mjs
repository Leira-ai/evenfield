// Local relay: bridges Chromium (which cannot CONNECT through the
// env egress proxy directly on this VM) to the environment egress
// proxy, listening on 127.0.0.1:18080. The upstream proxy URL is
// read from the environment at runtime; no credentials live here.
// Run: node probe/relay-18080.mjs   (background it; probes expect it)
import http from 'node:http';
import { URL } from 'node:url';

const upstream = new URL(process.env.https_proxy || process.env.HTTPS_PROXY || '');
const auth = upstream.username
  ? 'Basic ' + Buffer.from(decodeURIComponent(upstream.username) + ':' + decodeURIComponent(upstream.password)).toString('base64')
  : null;
const authHeaders = auth ? { 'Proxy-Authorization': auth } : {};

const server = http.createServer((req, res) => {
  const proxyReq = http.request(
    {
      host: upstream.hostname,
      port: Number(upstream.port),
      method: req.method,
      path: req.url,
      headers: { ...req.headers, ...authHeaders, host: new URL(req.url).host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(proxyReq);
});

server.on('connect', (req, clientSocket, head) => {
  const upstreamReq = http.request({
    host: upstream.hostname,
    port: Number(upstream.port),
    method: 'CONNECT',
    path: req.url,
    headers: authHeaders,
  });
  upstreamReq.on('connect', (upRes, socket, upHead) => {
    if (upRes.statusCode !== 200) {
      clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      socket.destroy();
      return;
    }
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length) socket.write(head);
    if (upHead && upHead.length) clientSocket.write(upHead);
    socket.pipe(clientSocket);
    clientSocket.pipe(socket);
    socket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => socket.destroy());
  });
  upstreamReq.on('error', () => clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
  upstreamReq.end();
});

server.listen(18080, '127.0.0.1', () => console.log('relay listening on 127.0.0.1:18080'));
