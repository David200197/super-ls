declare class SuperLocalStorage {
    register(ClassRef: any, typeName?: string): void;
    set(key: string, value: any): void;
    get<T = any>(key: string): T | null;
}

declare const superLs: SuperLocalStorage;

export default superLs;