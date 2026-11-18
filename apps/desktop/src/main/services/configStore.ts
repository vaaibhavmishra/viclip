import { Conf } from "electron-conf/main";

// Conf instances cache the entire file. Share one instance so settings writes
// cannot overwrite fresh authentication state or resurrect cleared secrets.
export const configStore = new Conf();
