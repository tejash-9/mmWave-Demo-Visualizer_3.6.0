"use strict";
/**
 *  Copyright (c) 2019, 2021, Texas Instruments Incorporated
 *  All rights reserved.
 *
 *   Redistribution and use in source and binary forms, with or without
 *   modification, are permitted provided that the following conditions
 *   are met:
 *
 *      Redistributions of source code must retain the above copyright
 *  notice, this list of conditions and the following disclaimer.
 *  notice, this list of conditions and the following disclaimer in the
 *  documentation and/or other materials provided with the distribution.
 *      Neither the name of Texas Instruments Incorporated nor the names of
 *  its contributors may be used to endorse or promote products derived
 *  from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 *  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 *  OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 *  OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 *  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 *  Original Author:
 *      Patrick Chuong, Texas Instruments, Inc.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
const optimist_1 = __importDefault(require("optimist"));
const path_1 = __importDefault(require("path"));
const serve_static_1 = __importDefault(require("serve-static"));
const http_1 = __importDefault(require("http"));
const os_1 = __importStar(require("os"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const url_1 = __importDefault(require("url"));
const child_process_1 = __importDefault(require("child_process"));
const TargetConfig_1 = require("./TargetConfig");
// @ts-ignore
const open_1 = __importDefault(require("open"));
/**
 * supported launcher.json parameters
 */
const PARAM_BROWSER = 'browser';
const PARAM_PORT = 'port';
const PARAM_SCRIPT = 'script';
const PARAM_LOGFILE = 'logfile';
const localhost = '127.0.0.1';
const instanceOfAddress = (arg) => {
    return !!arg.port;
};
/**
 * Get the app profile path
 */
const getProfilePath = (app) => {
    const getWin = () => path_1.default.join(os_1.homedir(), 'AppData', 'Local');
    const getLinux = () => path_1.default.join(os_1.homedir(), '.config');
    const getOSX = () => path_1.default.join(os_1.homedir(), 'Library', 'Application Support');
    const getDefault = () => os_1.platform().startsWith('win') ? getWin() : getLinux();
    let appDataPath = process.env['APPDATA'];
    if (!appDataPath) {
        switch (os_1.platform()) {
            case 'win32':
                appDataPath = getWin();
                break;
            case 'linux':
                appDataPath = getLinux();
                break;
            case 'darwin':
                appDataPath = getOSX();
                break;
            default:
                appDataPath = getDefault();
                break;
        }
    }
    return path_1.default.join(appDataPath, app);
};
/**
 * Returns the cloudagent platform.
 */
const getAgentPlatform = () => {
    switch (os_1.platform()) {
        case 'win32': return 'win';
        case 'linux': return 'linux';
        case 'darwin': return 'osx';
        default: return 'unsupported';
    }
};
/**
 * Splash screen
 */
const isNW = optimist_1.default.argv[PARAM_BROWSER].indexOf('nw') > 0;
if (isNW && !/^darwin/.test(process.platform)) {
    (async () => {
        const cleanup = async () => {
            const profilePath = getProfilePath('GUI Composer Splash' /* app/splash/package.json name property */);
            await fs_extra_1.default.remove(profilePath);
        };
        const splashProcess = await open_1.default('', { app: [optimist_1.default.argv[PARAM_BROWSER], path_1.default.join(__dirname, 'splash')] });
        splashProcess.on('exit', cleanup.bind(null));
        splashProcess.on('SIGINT', cleanup.bind(null));
        splashProcess.on('SIGUSR1', cleanup.bind(null));
        splashProcess.on('SIGUSR2', cleanup.bind(null));
        splashProcess.on('uncaughtException', cleanup.bind(null));
    })();
}
class ApplicationServer {
    constructor() {
        this.TICloudAgentPublicDir = path_1.default.join(__dirname, '../runtime/ticloudagent/server/public');
        this.targetConfig = new TargetConfig_1.TargetConfig(path_1.default.resolve(__dirname, '../runtime'));
        const serve = serve_static_1.default(__dirname, { index: ['index.html', 'index.htm'], extensions: ['js'] });
        this.server = http_1.default.createServer(async (req, res) => {
            const queryObj = url_1.default.parse(req.url || '', true);
            const pathname = queryObj.pathname || '';
            const api = pathname.substring('/api'.length + 1);
            /* respond headers */ {
                /* enable shared array buffer for scripting */
                res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
                res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            }
            /* runtime version.xml file route */
            if (pathname.indexOf('version.xml') !== -1) {
                const content = await fs_extra_1.default.readFile(path_1.default.join(__dirname, '../version.xml'), 'utf-8');
                res.writeHead(200, { 'Content-type': 'application/xml' });
                res.end(content);
                /* server-config.js file route */
            }
            else if (pathname.indexOf('server-config.js') !== -1) {
                const serverConfigObj = {
                    isOnline: false
                };
                let serverConfig = 'window.gc = window.gc || {};\n';
                serverConfig += `window.gc.serverConfig = ${JSON.stringify(serverConfigObj)};`;
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(serverConfig);
                /* ticloudagent routes */
            }
            else if (pathname.indexOf('/ticloudagent') === 0) {
                const reqPath = pathname.substring('/ticloudagent'.length + 1);
                const segments = reqPath.split('/');
                switch (segments[0]) {
                    case 'agent_config.json': {
                        const agentOutput = await this.startCloudAgentHostApp();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(agentOutput));
                        break;
                    }
                    case 'getConfigInfo': {
                        const result = await this.targetConfig.getConfigInfo(getAgentPlatform());
                        res.writeHead(200, { 'Content-Disposition': 'attachement;filename=target_setup.json' });
                        res.end(result);
                        break;
                    }
                    case 'getConfig': {
                        const [platform, connectionId, deviceId] = pathname.replace('/ticloudagent/getConfig/', '').split('/');
                        const result = await this.targetConfig.getConfig(platform, connectionId, deviceId);
                        res.writeHead(200, { 'Content-Disposition': 'attachment;filename=target.ccxml' });
                        res.end(result);
                        break;
                    }
                    default: {
                        const srcPath = path_1.default.join(this.TICloudAgentPublicDir, reqPath);
                        try {
                            const content = await fs_extra_1.default.readFile(srcPath, 'utf-8');
                            res.writeHead(200, { 'Content-Type': 'application/javascript' });
                            res.end(content);
                        }
                        catch (e) {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('File not found!');
                        }
                        break;
                    }
                }
                /* appscript route */
            }
            else if (pathname.indexOf('/appscript') === 0 && optimist_1.default.argv[PARAM_SCRIPT]) {
                try {
                    let filepath = optimist_1.default.argv[PARAM_SCRIPT].trim();
                    if (!path_1.default.isAbsolute(filepath)) {
                        filepath = path_1.default.join(__dirname, filepath);
                    }
                    const content = await fs_extra_1.default.readFile(filepath, 'utf-8');
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end(content);
                }
                catch (e) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end(e.toString());
                }
                /* log file route */
            }
            else if (pathname.indexOf('/logfile') === 0 && optimist_1.default.argv[PARAM_LOGFILE]) {
                let filepath = optimist_1.default.argv[PARAM_LOGFILE].trim();
                if (!path_1.default.isAbsolute(filepath)) {
                    filepath = path_1.default.join(__dirname, filepath);
                }
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(filepath);
                /* api route */
            }
            else if (pathname.indexOf('/api') === 0) {
                switch (api) {
                    case 'shutdown':
                        console.log('Server shutting received...');
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('OK');
                        if (!isNW) { /* shutdown for non-nodewebkit browser */
                            this.shutdown(0);
                        }
                        break;
                }
                /* default route */
            }
            else {
                serve(req, res, () => {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Invalid Request!');
                });
            }
        });
    }
    shutdown(code) {
        console.debug(`GUI Composer Server terminated, exit code = ${code}`);
        process.exit(code);
    }
    async startCloudAgentHostApp() {
        if (!this.agentHostAppPromise) {
            const ext = os_1.platform() === 'win32' ? 'bat' : 'sh';
            const cwd = path_1.default.join(__dirname, '../runtime/TICloudAgentHostApp');
            const executable = path_1.default.join(`${cwd}/ticloudagent.${ext}`);
            this.agentHostAppPromise = new Promise((resolve, reject) => {
                const app = child_process_1.default.spawn(executable, ['not_chrome'], { cwd: cwd });
                app.stdout.on('data', data => resolve(data.toString()));
                app.stderr.on('data', data => reject(data.toString()));
            }).then(data => {
                const _data = JSON.parse(data);
                _data.offline = true;
                _data.agentPort = _data.port;
                delete _data.port;
                console.log(`CloudAgent: ${JSON.stringify(_data)}`);
                return _data;
            });
        }
        return await this.agentHostAppPromise;
    }
    listen() {
        this.server.listen(optimist_1.default.argv[PARAM_PORT] || 0, '127.0.0.1', async () => {
            /* sanity check for the listening port */
            const address = this.server.address();
            if (instanceOfAddress(address)) {
                const port = address.port;
                this.server.port = port;
                console.log(`GUI Composer Application Server listening at port: ${port}`);
            }
            else {
                this.shutdown(1);
            }
            const browser = optimist_1.default.argv[PARAM_BROWSER];
            const url = `http://${localhost}:${this.server.port}`;
            console.log(`Launching browser ${browser} @ ${url}`);
            if (isNW) {
                /* read the package.json and create a temp folder using the app name */
                const packageJson = await fs_extra_1.default.readJson(path_1.default.join(__dirname, 'package.json'));
                let projectJson = {};
                try {
                    projectJson = await fs_extra_1.default.readJson(path_1.default.join(__dirname, 'project.json'));
                }
                catch (e) {
                    console.log('Warning: missing project.json file');
                }
                const appName = (projectJson.projectName || packageJson.name).replace(/\s+/g, '_');
                const tmpDir = await fs_extra_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), appName + '_'));
                /* set the url include the port number */
                packageJson.main = url;
                /* copy the icon file - nw.exe require it to be relative to the package.json */
                if (packageJson.window && projectJson.windowIcon) {
                    const legacyWindowIconPath = path_1.default.join(__dirname, 'images', projectJson.windowIcon); // legacy project with images folder
                    const srcIconPath = fs_extra_1.default.existsSync(legacyWindowIconPath) ? legacyWindowIconPath : path_1.default.join(__dirname, 'assets', projectJson.windowIcon);
                    const destIconPath = path_1.default.join(tmpDir, 'assets', projectJson.windowIcon);
                    await fs_extra_1.default.mkdirp(path_1.default.dirname(destIconPath));
                    fs_extra_1.default.createReadStream(srcIconPath).pipe(fs_extra_1.default.createWriteStream(destIconPath));
                    packageJson.window.icon = 'assets/' + projectJson.windowIcon;
                }
                /* write the package.json to the temp folder */
                await fs_extra_1.default.writeFile(path_1.default.join(tmpDir, 'package.json'), JSON.stringify(packageJson, undefined, 2));
                /* clean up temp folder and terminate process */
                const cleanup = async () => {
                    await fs_extra_1.default.remove(tmpDir);
                    await fs_extra_1.default.remove(path_1.default.join(getProfilePath(packageJson.name), os_1.platform() === 'win32' ? 'User Data' : '', 'Default', 'Web Data'));
                    this.shutdown(0);
                };
                process.on('exit', cleanup.bind(null));
                process.on('SIGINT', cleanup.bind(null));
                process.on('SIGUSR1', cleanup.bind(null));
                process.on('SIGUSR2', cleanup.bind(null));
                process.on('uncaughtException', cleanup.bind(null));
                /* launch nw */
                await open_1.default('', { app: [path_1.default.isAbsolute(browser) ? browser : path_1.default.join(__dirname, browser), tmpDir], wait: true });
                /* when nw or browser process exit, kill ourself */
                cleanup();
            }
            else {
                /* launch browser */
                await open_1.default(url, { app: browser, wait: true });
            }
        });
    }
}
new ApplicationServer().listen();
//# sourceMappingURL=ApplicationServer.js.map