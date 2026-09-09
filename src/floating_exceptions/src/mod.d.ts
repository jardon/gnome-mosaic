declare const log: (arg: string) => void, imports: any;

declare module 'gettext' {
    const Gettext: {
        gettext(msgid: string): string;
        dgettext(domainName: string | null, msgid: string): string;
        ngettext(msgid1: string, msgid2: string, n: number): string;
        textdomain(domainName: string): void;
        bindtextdomain(domainName: string, dirName: string): void;
        domain(domainName: string): any;
    };

    export default Gettext;
}

declare module 'gi://*' {
    let data: any;
    export default data;
}

declare module 'gi://Gtk' {
    let Gtk: any;
    export default Gtk;
}
