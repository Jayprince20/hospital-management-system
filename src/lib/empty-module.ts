// Stand-in for Node built-ins (fs, path) that the DICOM codec loaders (Emscripten output) only
// require on their Node code path; in the browser they are never called.
const empty = {};
export default empty;
