# How everything connects

| Component   | Uses                           |
| ----------- | ------------------------------ |
| frontend    | VERSION                        |
| VERSION     | release tag                    |
| release tag | asset URLs                     |
| gh-pages    | built site referencing VERSION |

# How my web app fetches data
| Files | Method | Priority |
| JSON Data | JsDelivr | 1 |
| GLB Files | JsDelivr | 2 |
| HTML Files | GitHub Pages | 3 |

* JSON Data and GLB Files shld be fetched in order of priority simulatenously as the Github Pages hosted site loads.


## 2. Utilise JsDelivr
```js
const BASE = `https://cdn.jsdelivr.net/gh/garethlearnscoding/funtasia_app@${VERSION}/public`;
```

---
Instead of hardcoding:

```js
const VERSION = __APP_VERSION__;
```

Then in `vite.config.js`:

```js
define: {
  __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
}
```


---
