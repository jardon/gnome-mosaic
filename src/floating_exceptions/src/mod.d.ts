declare const log: (arg: string) => void,
    imports: any,
    _: (arg: string) => string;

declare module 'gi://*' {
    let data: any;
    export default data;
}

declare module 'gi://Gtk' {
    let Gtk: any;
    export default Gtk;
}
