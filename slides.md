# Reactivity from scratch

## Pierre Robillard

### Touraine Tech - 2026/02/12

---

# Qui suis-je

- Développeur fonctionnel
  - Backend (NodeJS) / Front-end (Web)
- Rejoint les Code-Troopers depuis 2018
  - Venez nous rencontrez 🍻

---

# Signals ? Fined-grained reactivity ?

- La dernière hype des frameworks JS
- Solid.js, Vue, Angular, Preact...
- TC39 proposal (stage 1, August 2024)

Mais c'est quoi la réactivité...

---

<!-- partons de la base, comment on fait une interface web sans framework ? -->

```ts
const header = document.getElementById('hgreet')
const nameInput = document.getElementById('name')

nameInput.addEventListener('input', (e) => {
  header.textContent = `Hello, ${e.target.value}!`
})
```

---

<!-- complexifions légèrement l'exemple on ajoute un deuxième input -->
<!-- comment gérer le deuxième event listener, garder la mémoire -->

```ts
const header = document.getElementById('hgreet')
const firstNameInput = document.getElementById('fname')
const lastNameInput = document.getElementById('lname')

firstNameInput.addEventListener('input', (e) => {
  header.textContent = `Hello, ${e.target.value}!`
})

lastNameInput.addEventListener('input', (e) => {
  // ???
})
```

---

<!-- on introduit deux variables -->

```ts
const header = document.getElementById('hgreet')
const firstNameInput = document.getElementById('fname')
const lastNameInput = document.getElementById('lname')

let firstName: string = ''
let lastName: string = ''

firstNameInput.addEventListener('input', (e) => {
  firstName = e.target.value
  header.textContent = `Hello, ${firstName} ${lastName}!`
})

lastNameInput.addEventListener('input', (e) => {
  lastName = e.target.value
  header.textContent = `Hello, ${firstName} ${lastName}!`
})
```

---

<!-- on refactor pour éviter la répétition -->

```ts
const header = document.getElementById('hgreet')
const firstNameInput = document.getElementById('fname')
const lastNameInput = document.getElementById('lname')

let firstName: string = ''
let lastName: string = ''

const fullName = () => [firstName, lastName].join(' ')

firstNameInput.addEventListener('input', (e) => {
  firstName = e.target.value
  header.textContent = `Hello, ${fullName()}!`
})

lastNameInput.addEventListener('input', (e) => {
  lastName = e.target.value
  header.textContent = `Hello, ${fullName()}!`
})
```

---

<!-- On écrit plus nos app comme ça, mais l'exemple nous montre les trois primitives pour faire des UI interactives --->

1. Des données que l'utilisateur peut lire & modifier

2. Des données qui sont dérivés d'autres données

3. Des effets de bords qui dépendent de données

### Les primitives réactives

1. Signals (Observable, state...)

2. Derivations (Computations, memos...)

3. Effects

---

<!-- Réecrivons notre précdent exemple avec nos trois nouvelles primitives réactives -->

```ts
import { createSignal, createEffect, createComputed } from './reactivity'

const header = document.getElementById('hgreet')
const firstNameInput = document.getElementById('fname')
const lastNameInput = document.getElementById('lname')

const [firstName, setFirstName] = createSignal('Luke')
const [lastName, setLastName] = createSignal('Skywalker')

firstNameInput.addEventListener('input', (e) => {
  setFirstName(e.target.value)
})
lastNameInput.addEventListener('input', (e) => {
  setLastName(e.target.value)
})

const fullName = createComputed(() => `${firstName()} ${lastName()}`)

createEffect(() => {
  header.textContent = `Hello ${fullName()} !`
})
```

---

<!-- Pour alléger la lecture, on enlève la manipulation du DOM et on fait du console.log -->

```ts
import { createSignal, createEffect, createComputed } from './reactivity'

const [firstName, setFirstName] = createSignal('Luke')
const [lastName, setLastName] = createSignal('Skywalker')

const fullName = createComputed(() => `${firstName()} ${lastName()}`)

createEffect(() => {
  console.log(`Hello ${fullName()} !}`)
})

setFirstName('Leila')
```

Console ouput :

```
> Hello Luke Skywalker !
> Hello Leila Skywalker !
```

---

<!-- Faison l'implémentation de notre librairie réactive -->
<!-- Commençons par définir les interfaces de nos signals -->
<!-- A la base ce n'est que un getter/setter sur une valeur, ici un tuple -->

```ts
type Signal<T> = [getter: () => T, setter: (val: T) => void]

export function createSignal<T>(value: T): Signal<T> {
  const read = () => {
    return //...
  }
  const write = (nextVal: T) => {
    //...
  }
  return [read, write]
}
```

---

<!-- On doit commencer par retourner cette valeur, et être capable de la modifier --->

```ts
type Signal<T> = [getter: () => T, setter: (val: T) => void]

export function createSignal<T>(value: T): Signal<T> {
  const read = () => {
    return value
  }
  const write = (nextVal: T) => {
    value = nextVal
  }
  return [read, write]
}
```

---

<!-- Mais pour être réactif, le signal doit garder la liste des effets qui sont dépendent --->
<!-- afin d'être capable de les notifiers quand une valeur change --->

```ts
type Effect = () => void
type Signal<T> = [getter: () => T, setter: (val: T) => void]

export function createSignal<T>(value: T): Signal<T> {
  const subscribers = new Set<Effect>()

  const read = () => {
    return value
  }
  const write = (nextVal: T) => {
    value = nextVal
  }
  return [read, write]
}

export function createEffect(fn: Effect) {
  //...
}
```

---

<!-- On introduit une stack global d'effets, une stack de context réactive --->
<!-- Le but de createEffect est de wrapper nos effets de bords dans une fonction --->
<!-- d'ajouter ce wrapper à la stack, d'éxécuter l'effet de bord puis de l'enlever de la stack --->

```ts
type Effect = () => void
type Signal<T> = [getter: () => T, setter: (val: T) => void]

export function createSignal<T>(value: T): Signal<T> {
  const subscribers = new Set<Effect>()

  const read = () => {
    return value
  }
  const write = (nextVal: T) => {
    value = nextVal
  }
  return [read, write]
}

const context: Effect[] = []

export function createEffect(fn: Effect) {
  const execute = () => {
    context.push(execute)
    try {
      fn()
    } finally {
      context.pop()
    }
  }
  execute()
}
```

---

<!-- Quand on lit la valeur d'un signal à lintérrieur d'un effet, on ajoute le dernier effet en cours dans la stack des context à la liste des subcriber --->
<!-- Quand on écrit la valeur d'un signal on peut notifier les subcribers pour les réexecuter --->

```ts
type Effect = () => void
type Signal<T> = [getter: () => T, setter: (val: T) => void]

export function createSignal<T>(value: T): Signal<T> {
  const subscribers = new Set<Effect>()

  const read = () => {
    if (context.at(-1)) {
      subscribers.add(context.at(-1)!)
    }
    return value
  }
  const write = (nextVal: T) => {
    value = nextVal
    subscribers.forEach((sub) => sub())
  }
  return [read, write]
}

const context: Effect[] = []

export function createEffect(fn: Effect) {
  const execute = () => {
    context.push(execute)
    try {
      fn()
    } finally {
      context.pop()
    }
  }
  execute()
}
```

---

<!-- La dernière pièce du puzzle notre createComputed --->

```ts
type Effect = () => void
type Signal<T> = [getter: () => T, setter: (val: T) => void]

export function createSignal<T>(value: T): Signal<T> {
  const subscribers = new Set<Effect>()

  const read = () => {
    if (context.at(-1)) {
      subscribers.add(context.at(-1)!)
    }
    return value
  }
  const write = (nextVal: T) => {
    value = nextVal
    subscribers.forEach((sub) => sub())
  }
  return [read, write]
}

const context: Effect[] = []

export function createEffect(fn: Effect) {
  const execute = () => {
    context.push(execute)
    try {
      fn()
    } finally {
      context.pop()
    }
  }
  execute()
}

export function createComputed<T>(fn: () => T): () => T {
  return // ...
}
```

---

<!-- On reste simple pour le moment --->

```ts
type Effect = () => void
type Signal<T> = [getter: () => T, setter: (val: T) => void]

export function createSignal<T>(value: T): Signal<T> {
  const subscribers = new Set<Effect>()

  const read = () => {
    if (context.at(-1)) {
      subscribers.add(context.at(-1)!)
    }
    return value
  }
  const write = (nextVal: T) => {
    value = nextVal
    subscribers.forEach((sub) => sub())
  }
  return [read, write]
}

const context: Effect[] = []

export function createEffect(fn: Effect) {
  const execute = () => {
    context.push(execute)
    try {
      fn()
    } finally {
      context.pop()
    }
  }
  execute()
}

export function createComputed<T>(fn: () => T): () => T {
  return fn
}
```

---

# On l'a fait !

- On a construit un graphe réactif
- Entièrement au runtime
  - Pas de compilateur
- Avec de l'autotracking
  - Pas de "dependencies array"

---

# Edge case 1

```ts
import { createSignal, createComputed, createEffect } from './reactivity'

const [firstName, setFirstName] = createSignal('Luke')
const [lastName, setLastName] = createSignal('Skywalker')

const fullName = createComputed(() => {
  console.log('...doing hard work...')
  return `${firstName()} ${lastName()}`
})

createEffect(() => {
  console.log(`Hello ${fullName()} !}`)
  console.log(`Goodbye ${fullName()} !}`)
})

setFirstName('Darth')
```

Console output :

```

```

<!-- TODO add the Y shape graph of dependencies --->

---

# Le fix ?

```ts
export function createComputed<T>(fn: () => T): () => T {
  const [read, write] = createSignal(fn())

  createEffect(() => {
    write(fn())
  })

  return read
}
```

---

# Edge case 2

```ts
import { createSignal, createComputed, createEffect } from './reactivity'

const [name, setName] = createSignal({ first: 'Luke', last: 'Skywalker' })

const lowerFirst = createComputed(() => name().first.toLowerCase())
const upperLast = createComputed(() => name().last.toUpperCase())
const greets = createComputed(() => `Hello, ${lowerFirst()} ${upperLast()}`)

createEffect(() => {
  console.log(greets())
})

setName({ first: 'Darth', last: 'Vader' })
```

Console output :

```

```

<!-- TODO add the diadmond shape graph of dependencies --->

---

# Le fix ?

- Soit on revient à une simple fonction.
- Soit on passe à une architecture "Push-pull" en deux phases :
  1.  "notification" on marque les noeud comme "dirty"
  2.  "execution" on effectue les calculs dans l'ordre

---

## Crédit et références :

La plupart des idées ne sont pas originales, c’est le mix de plusieurs autres par des personnes plus brillantes que moi, le crédit leur revient :

- WTF is Reactivity - Damien Chazoule
  - [https://dev.to/dmnchzl/wtf-is-reactivity--4c1h]()
- Simplifying reactivity with solidJS - Dan Jutan
  - [https://youtu.be/qB5jK-KeXOs]()
- SolidJS
  - [https://www.solidjs.com/guides/reactivity]()
- Building a Reactive Library from Scratch - Ryan Carniato
  - [https://dev.to/ryansolid/building-a-reactive-library-from-scratch-1i0p]()
