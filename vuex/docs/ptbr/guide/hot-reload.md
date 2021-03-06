# Hot Reloading (Recarregamento Rápido)

O Vuex suporta _hot-reloading_ de mutações, módulos, ações e _getters_ durante o desenvolvimento, utilizando o _webpack_ [Hot Module Replacement API](https://webpack.js.org/guides/hot-module-replacement/). Você também pode usá-lo no Browserify com o _plugin_ [browserify-hmr](https://github.com/AgentME/browserify-hmr/).

Para mutações e módulos, você precisa usar o método da API `store.hotUpdate()`:

``` js
// store.js
import { createStore } from 'vuex'
import mutations from './mutations'
import moduleA from './modules/a'

const state = { ... }

const store = createStore({
  state,
  mutations,
  modules: {
    a: moduleA
  }
})

if (module.hot) {
  // aceita ações e mutações como 'hot modules'
  module.hot.accept(['./mutations', './modules/a'], () => {
    // requer os módulos atualizados
    // tem que adicionar .default aqui devido à saída do módulo babel 6
    const newMutations = require('./mutations').default
    const newModuleA = require('./modules/a').default
    // troca nas novas ações e mutações
    store.hotUpdate({
      mutations: newMutations,
      modules: {
        a: newModuleA
      }
    })
  })
}
```

Confira o [counter-hot example](https://github.com/vuejs/vuex/tree/main/examples/counter-hot) para brincar com o _hot-reload_.

## Módulo dinâmico de hot reloading

Se você usa exclusivamente módulos, você pode usar `require.context` para carregar e recarregar todos os módulos dinamicamente.

```js
// store.js
import { createStore } from 'vuex'

// Carrega todos os módulos.
function loadModules() {
  const context = require.context("./modules", false, /([a-z_]+)\.js$/i)

  const modules = context
    .keys()
    .map((key) => ({ key, name: key.match(/([a-z_]+)\.js$/i)[1] }))
    .reduce(
      (modules, { key, name }) => ({
        ...modules,
        [name]: context(key).default
      }),
      {}
    )

  return { context, modules }
}

const { context, modules } = loadModules()

const store = createStore({
  modules
})

if (module.hot) {
  // Hot reload sempre que qualquer módulo for alterado.
  module.hot.accept(context.id, () => {
    const { modules } = loadModules()

    store.hotUpdate({
      modules
    })
  })
}
```
