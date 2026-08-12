(function(){
"use strict";

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

function registerPlugin(e) { window.enmity.plugins.registerPlugin(e); }
function getByProps(...e) { return window.enmity.modules.getByProps(...e); }
function createPatcher(e) { return window.enmity.patcher.create(e); }

const manifest = {
    name: "VRSpoof",
    version: "1.0.0",
    description: "Spoofs your Discord client to appear as a VR Headset",
    authors: [{ name: "8counts", id: "0" }],
};

const Patcher = createPatcher(manifest.name);

const plugin = {
    ...manifest,
    onStart() {
        let hooked = false;

        // Approach 1: Hook identify on the gateway socket
        try {
            const GW = getByProps("identify", "send", "close");
            if (GW && typeof GW.identify === "function") {
                Patcher.before(GW, "identify", (_, args) => {
                    try {
                        const p = args[0];
                        if (p && p.d && p.d.properties) {
                            p.d.properties = Object.assign({}, VR_PROPS);
                        } else if (p && p.properties) {
                            p.properties = Object.assign({}, VR_PROPS);
                        }
                    } catch(e) {}
                });
                hooked = true;
                console.log("[VRSpoof] Hooked gateway identify");
            }
        } catch(e) {}

        // Approach 2: Hook send and intercept op:2
        if (!hooked) {
            try {
                const SM = getByProps("send", "close");
                if (SM && typeof SM.send === "function") {
                    Patcher.before(SM, "send", (_, args) => {
                        try {
                            let data = args[0];
                            let parsed = typeof data === "string" ? JSON.parse(data) : data;
                            if (parsed && parsed.op === 2 && parsed.d && parsed.d.properties) {
                                parsed.d.properties = Object.assign({}, VR_PROPS);
                                args[0] = typeof data === "string" ? JSON.stringify(parsed) : parsed;
                            }
                        } catch(e) {}
                    });
                    hooked = true;
                    console.log("[VRSpoof] Hooked socket send");
                }
            } catch(e) {}
        }

        // Approach 3: Hook Dispatcher
        if (!hooked) {
            try {
                const Dispatcher = getByProps("_currentDispatchActionType", "_subscriptions");
                if (Dispatcher && typeof Dispatcher.dispatch === "function") {
                    Patcher.before(Dispatcher, "dispatch", (_, args) => {
                        try {
                            const action = args[0];
                            if (action && (action.type === "GATEWAY_IDENTIFY" || action.type === "IDENTIFY")) {
                                if (action.properties) action.properties = Object.assign({}, VR_PROPS);
                                if (action.d && action.d.properties) action.d.properties = Object.assign({}, VR_PROPS);
                            }
                        } catch(e) {}
                    });
                    console.log("[VRSpoof] Hooked Dispatcher");
                }
            } catch(e) {}
        }
    },

    onStop() {
        Patcher.unpatchAll();
    },
};

registerPlugin(plugin);
})();
