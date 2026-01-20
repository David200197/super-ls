import { stringify, parse } from 'devalue';

class SuperLocalStorage {
    constructor() {
        this.registry = new Map();
        this.prefix = 'sls_'; 
    }

    register(ClassRef, typeName = null) {
        if (typeof ClassRef !== 'function') throw new Error("This is not a valid class.");
        const finalName = typeName || ClassRef.name;
        this.registry.set(finalName, ClassRef);
    }

    set(key, value) {
        let payload = value;

        for (const [name, Constructor] of this.registry.entries()) {
            if (value instanceof Constructor) {
                payload = {
                    __super_type__: name,
                    __data__: value
                };
                break;
            }
        }

        const serialized = stringify(payload);

        t.ls.set(this.prefix + key, serialized);
    }

    get(key) {
        const raw = t.ls.get(this.prefix + key);
        if (!raw) return null;

        return parse(raw, (value) => {
            if (value && value.__super_type__) {
                const Name = value.__super_type__;
                const Data = value.__data__;
                const Constructor = this.registry.get(Name);

                if (Constructor) {
                    if (typeof Constructor.hydrate === 'function') {
                        return Constructor.hydrate(Data);
                    }
                    const instance = new Constructor();
                    Object.assign(instance, Data);
                    return instance;
                }
            }
            return value;
        });
    }
}

const superLs = new SuperLocalStorage();

export default superLs;