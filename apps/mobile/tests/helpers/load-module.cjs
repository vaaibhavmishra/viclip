const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const mobileRoot = path.resolve(__dirname, "../..");
const repositoryRoot = path.resolve(mobileRoot, "../..");

/** Execute application TypeScript with isolated native/service mocks per test. */
function loadModule(filename, mocks = {}, globals = {}) {
  const entryFile = path.resolve(mobileRoot, filename);
  const cache = new Map();
  function load(file) {
    const resolved = path.resolve(file);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = { exports: {} };
    cache.set(resolved, module);
    const code = ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
      fileName: resolved,
    }).outputText;
    function mockRequire(request) {
      if (request === "react-native-safe-area-context") {
        return {
          SafeAreaView: "SafeAreaView",
          SafeAreaProvider: "SafeAreaProvider",
          useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
          ...mocks[request],
        };
      }
      if (
        Object.hasOwn(mocks, request) &&
        (!request.startsWith(".") || resolved === entryFile)
      )
        return mocks[request];
      let target;
      if (request.startsWith("./") || request.startsWith("../")) {
        target = path.resolve(path.dirname(resolved), request);
      } else if (request.startsWith("@/")) {
        target = path.resolve(mobileRoot, request.slice(2));
      } else if (request.startsWith("@viclip/")) {
        target = path.resolve(
          repositoryRoot,
          "packages",
          request.slice("@viclip/".length),
          "src/index",
        );
      } else if (request.startsWith("node:")) {
        return require(request);
      } else {
        throw new Error(
          `Unmocked dependency ${request} imported by ${resolved}`,
        );
      }
      const candidates = [
        target,
        `${target}.ts`,
        `${target}.tsx`,
        `${target}.js`,
      ];
      const found = candidates.find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      );
      if (!found)
        throw new Error(`Unable to resolve ${request} from ${resolved}`);
      if (Object.hasOwn(mocks, found)) return mocks[found];
      return load(found);
    }
    const context = vm.createContext({
      module,
      exports: module.exports,
      require: mockRequire,
      console: {
        debug() {},
        info() {},
        warn() {},
        error() {},
        log() {},
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      URL,
      Buffer,
      process: { env: {} },
      ...globals,
    });
    vm.runInContext(code, context, { filename: resolved });
    return module.exports;
  }
  return load(entryFile);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

module.exports = { loadModule, deferred };
