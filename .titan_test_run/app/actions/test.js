export const test = (req) => {
    const ext = t["titanpl-superls"];

    const results = {
        extension: "titanpl-superls",
        loaded: !!ext,
        methods: ext ? Object.keys(ext) : [],
        timestamp: new Date().toISOString()
    };

    if (ext) {
        // Mock t.ls for local env if missing
        if (!t.ls) {
            const mockStore = new Map();
            t.ls = {
                set: (k, v) => mockStore.set(k, v),
                get: (k) => mockStore.get(k),
                remove: (k) => mockStore.delete(k)
            };
        }

        try {
            results.debug_ext = {
                keys: Object.keys(ext),
                hasDefault: 'default' in ext,
                type: typeof ext
            };
            const superLs = ext.default || ext;
            if (typeof superLs.set !== 'function') {
                results.debug_superLs = {
                    type: typeof superLs,
                    keys: Object.keys(superLs),
                    isExt: superLs === ext
                };
            }
            const settings = new Map([
                ["theme", "dark"],
                ["language", "en"]
            ]);

            superLs.set("user_settings", settings);
            
            const recovered = superLs.get("user_settings");
            t.log(recovered instanceof Map); // true
            t.log(recovered.get("theme"));   // "dark"

            superLs.remove("user_settings");

            t.log("user_settings", superLs.has("user_settings"))
        } catch (e) {
            results.hello_error = String(e);
        }
    }


    return results;
};
