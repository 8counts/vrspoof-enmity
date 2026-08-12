import { after, instead } from "@vendetta/patcher";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";

// ─── VR Properties injected into every IDENTIFY payload ──────────────────────
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

// ─── Fallback real props (used only if we ever need to revert mid-session) ───
const REAL_PROPS = {
    os: "iOS",
    browser: "Discord iOS",
    device: "iPhone",
    system_locale: "en-US",
    browser_user_agent: "",
    browser_version: "",
    os_version: "",
    referrer: "",
    referring_domain: "",
};

// ─── Patches storage ─────────────────────────────────────────────────────────
let patches: (() => void)[] = [];

// ─── Try to find Discord's gateway/socket send internals ─────────────────────
function hookGateway() {
    // Discord internally uses a module that builds the IDENTIFY payload.
    // We hook `identify` or the internal `send` that carries `op: 2` (IDENTIFY).

    // Approach 1: Hook the GatewaySocket / FluxDispatcher identify builder
    const GatewaySocket = findByProps("identify", "send", "close");
    if (GatewaySocket?.identify) {
        const unpatch = instead("identify", GatewaySocket, (args, orig) => {
            const payload = args[0];
            if (payload?.d?.properties) {
                payload.d.properties = { ...VR_PROPS };
            } else if (payload?.properties) {
                payload.properties = { ...VR_PROPS };
            }
            return orig(...args);
        });
        patches.push(unpatch);
        console.log("[VRSpoof] ✅ Hooked GatewaySocket.identify");
        return true;
    }

    // Approach 2: Hook lower-level `send` and intercept op:2 IDENTIFY packets
    const SocketManager = findByProps("send", "close", "_socket") 
        || findByProps("send", "handleClose");
    if (SocketManager?.send) {
        const unpatch = instead("send", SocketManager, (args, orig) => {
            try {
                let data = args[0];
                // Data may be a string (JSON) or object
                let parsed = typeof data === "string" ? JSON.parse(data) : data;
                if (parsed?.op === 2 && parsed?.d?.properties) {
                    parsed.d.properties = { ...VR_PROPS };
                    args[0] = typeof data === "string" 
                        ? JSON.stringify(parsed) 
                        : parsed;
                }
            } catch (_) {}
            return orig(...args);
        });
        patches.push(unpatch);
        console.log("[VRSpoof] ✅ Hooked SocketManager.send (op:2 intercept)");
        return true;
    }

    // Approach 3: Hook the gateway connection module directly
    const Gateway = findByProps("_sendIdentify", "dispatch");
    if (Gateway?._sendIdentify) {
        const unpatch = instead("_sendIdentify", Gateway, (args, orig) => {
            const payload = args[0];
            if (payload?.d?.properties) {
                payload.d.properties = { ...VR_PROPS };
            }
            return orig(...args);
        });
        patches.push(unpatch);
        console.log("[VRSpoof] ✅ Hooked Gateway._sendIdentify");
        return true;
    }

    console.warn("[VRSpoof] ⚠️ Could not find gateway hook target — trying Flux dispatch hook");

    // Approach 4: Flux dispatch hook for IDENTIFY action type
    const FluxDispatcher = findByProps("dispatch", "subscribe");
    if (FluxDispatcher?.dispatch) {
        const unpatch = instead("dispatch", FluxDispatcher, (args, orig) => {
            try {
                const action = args[0];
                if (
                    action?.type === "GATEWAY_IDENTIFY" ||
                    action?.type === "IDENTIFY"
                ) {
                    if (action.properties) {
                        action.properties = { ...VR_PROPS };
                    }
                    if (action?.d?.properties) {
                        action.d.properties = { ...VR_PROPS };
                    }
                }
            } catch (_) {}
            return orig(...args);
        });
        patches.push(unpatch);
        console.log("[VRSpoof] ✅ Hooked FluxDispatcher.dispatch");
        return true;
    }

    console.error("[VRSpoof] ❌ All hook approaches failed");
    return false;
}

// ─── Plugin lifecycle ─────────────────────────────────────────────────────────
export default {
    onLoad() {
        console.log("[VRSpoof] Loading — injecting VR identity properties...");
        hookGateway();
    },

    onUnload() {
        patches.forEach(p => p());
        patches = [];
        console.log("[VRSpoof] Unloaded — all patches removed.");
    },
};
