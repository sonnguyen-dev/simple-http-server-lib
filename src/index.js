

const http  = require('http');
const url   = require('url');
const color = require('colors');
const debug = require('debug')('http-server');

const colorCode = (code) => {
    if (code < 300) return code.toString().green;
    return code.toString().red;
};

const isProd = process.env.NODE_ENV === 'production';

const stringify = json => {
    return JSON.stringify(json, (key, value) => {
        if (value != null) return value;
    });
};

class HttpServer {
    constructor() {
        this.routes = {};
    }

    get(path, handler) {
        this.routes[path] = {
            method: 'GET', handler,
        };
    }

    post(path, handler) {
        this.routes[path] = {
            method: 'POST', handler,
        };
    }

    listen(port, hostname, callback) {
        const server = http.createServer(async (req, res) => {

            req.ip      = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            req.country = req.headers['cf-ipcountry'] || req.headers['x-country'] || 'XX';

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            res.json = (data) => {
                try {
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                    });
                    res.end(stringify(data));
                    debug(`${req.ip} - [${req.method}] ${req.pathName} - ${req.headers['user-agent']} - ${data.status} ${JSON.stringify(req.query)}`);
                } catch (err) {
                    debug(`${req.method} ${req.url} - cannot send response: ${err.message}`);
                }
            };

            const parsedUrl = url.parse(req.url, true);
            const route     = this.routes[parsedUrl.pathname];
            req.pathName    = parsedUrl.pathname;

            if (route) {
                if (req.method === 'OPTIONS') {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                if (route.method === req.method) {
                    if (route.method === 'POST') {
                        let requestBody = '';
                        req.on('data', chunk => {
                            try {
                                requestBody += chunk.toString();
                            } catch (err) {
                                debug(`${req.method} ${req.url} - cannot parse request body: ${err.message}`);
                                res.json({
                                    status: 400, message: 'Bad Request', error: err.message, stack: !isProd ? err.stack : undefined,
                                });
                            }
                        });

                        req.on('end', async () => {
                            try {
                                req.body = JSON.parse(requestBody);
                                try {
                                    await route.handler(req, res);
                                } catch (err) {
                                    debug(`${req.method} ${req.url} - Internal server error: ${err.message}`);

                                    res.json({
                                        status: 500, message: 'Internal server error', error: err.message, stack: !isProd ? err.stack : undefined,
                                    });
                                }
                            } catch (err) {
                                debug(`${req.method} ${req.url} - Bad Request: ${err.message}`);

                                res.json({
                                    status: 400, message: 'Bad Request', error: err.message, stack: !isProd ? err.stack : undefined,
                                });
                            }
                        });
                    } else {
                        try {
                            req.query = parsedUrl.query;
                            try {
                                await route.handler(req, res);
                            } catch (err) {
                                debug(`${req.method} ${req.url} - Internal server error: ${err.message}`);

                                res.json({
                                    status: 500, message: 'Internal server error', error: err.message, stack: !isProd ? err.stack : undefined,
                                });
                            }
                        } catch (err) {
                            debug(`${req.method} ${req.url} - Bad Request: ${err.message}`);

                            res.json({
                                status: 400, message: 'Bad Request', error: err.message, stack: !isProd ? err.stack : undefined,
                            });
                        }
                    }
                } else {
                    res.json({ status: 405, message: 'Method Not Allowed' });
                }
            } else {
                res.json({ status: 404, message: 'Not Found' });
            }
        });
        server.listen(port, hostname, callback);
    }
}

module.exports = HttpServer;
