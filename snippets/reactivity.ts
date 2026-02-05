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
  const [read, write] = createSignal(fn())

  createEffect(() => {
    write(fn())
  })

  return read
}
