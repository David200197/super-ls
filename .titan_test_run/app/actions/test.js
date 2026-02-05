export const test = (req) => {
    const ext = t["titanpl-superls"];
    
    const results = {
        extension: "titanpl-superls",
        loaded: !!ext,
        methods: ext ? Object.keys(ext) : [],
        timestamp: new Date().toISOString()
    };
    
    if (ext && ext.hello) {
        try {
            results.hello_test = ext.hello("World");
        } catch(e) {
            results.hello_error = String(e);
        }
    }
    
    if (ext && ext.calc) {
        try {
            results.calc_test = ext.calc(15, 25);
        } catch(e) {
            results.calc_error = String(e);
        }
    }
    
    return results;
};
