// VRSpoof - Enmity Plugin (plain JS, no build required)

const VR_PROPS = {
    os: "Console",
    browser: "Discord VR",
    device: "VR-Headset",
    system_locale: "en-US",
    browser_user_agent: "DiscordVR/12.45 (Windows)",
    browser_version: "23.7.91",
    os_version: "10.0.45",
    referrer: "",
    referring_domain: "",
};

let patches = [];

function findByProps(...props) {
    const modules = window.vendetta?.metro?.findByProps
        || globalThis?.vendetta?.metro?.findByProps;
    if (modules) return modules(...props);
    return null;
}

function instead(method, obj, fn) {
    const orig = obj[method].bind(obj);
    obj[method] = function(...args) { return fn(args, orig); };
    return () => { obj[method] = orig; };
}

function hookGateway() {
    // Approach 1: GatewaySocket.identify
    try {
        const GW = findByProps("identify", "send", "close");
        if (GW && typeof GW.identify === "function") {
            const u = instead("identify", GW, (args, orig) => {
                const p = args[0];
                if (p?.d?.properties) p.d.properties = { ...VR_PROPS };
                else if (p?.properties) p.properties = { ...VR_PROPS };
                return orig(...args);
            });
            patches.push(u);
            console.log("[VRSpoof] Hooked GatewaySocket.identify");
            return;
        }
    } catch(_) {}

    // Approach 2: intercept send() for op:2 IDENTIFY
    try {
        const SM = findByProps("send", "close", "_socket") || findByProps("send", "handleClose");
        if (SM && typeof SM.send === "function") {
            const u = instead("send", SM, (args, orig) => {
                try {
                    let data = args[0];
                    let parsed = typeof data === "string" ? JSON.parse(data) : data;
                    if (parsed?.op === 2 && parsed?.d?.properties) {
                        parsed.d.properties = { ...VR_PROPS };
                        args[0] = typeof data === "string" ? JSON.stringify(parsed) : parsed;
                    }
                } catch(_) {}
                return orig(...args);
            });
            patches.push(u);
            console.log("[VRSpoof] Hooked SocketManager.send");
            return;
        }
    } catch(_) {}

    // Approach 3: _sendIdentify
    try {
        const GW2 = findByProps("_sendIdentify");
        if (GW2 && typeof GW2._sendIdentify === "function") {
            const u = instead("_sendIdentify", GW2, (args, orig) => {
                const p = args[0];
                if (p?.d?.properties) p.d.properties = { ...VR_PROPS };
                return orig(...args);
            });
            patches.push(u);
            console.log("[VRSpoof] Hooked _sendIdentify");
            return;
        }
    } catch(_) {}

    // Approach 4: FluxDispatcher
    try {
        const FD = findByProps("dispatch", "subscribe");
        if (FD && typeof FD.dispatch === "function") {
            const u = instead("dispatch", FD, (args, orig) => {
                try {
                    const a = args[0];
                    if (a?.type === "GATEWAY_IDENTIFY" || a?.type === "IDENTIFY") {
                        if (a.properties) a.properties = { ...VR_PROPS };
                        if (a?.d?.properties) a.d.properties = { ...VR_PROPS };
                    }
                } catch(_) {}
                return orig(...args);
            });
            patches.push(u);
            console.log("[VRSpoof] Hooked FluxDispatcher.dispatch");
        }
    } catch(_) {}
}

module.exports = {
    onLoad() {
        console.log("[VRSpoof] Loading...");
        hookGateway();
    },
    onUnload() {
        patches.forEach(p => p());
        patches = [];
        console.log("[VRSpoof] Unloaded.");
    },
};
