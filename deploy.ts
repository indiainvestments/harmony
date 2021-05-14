import { Interaction } from './src/structures/interactions.ts'
import {
  SlashCommandsManager,
  SlashClient,
  SlashCommandHandlerCallback,
  SlashCommandHandler
} from './src/interactions/mod.ts'
import {
  InteractionResponseType,
  InteractionType
} from './src/types/interactions.ts'

export interface DeploySlashInitOptions {
  env?: boolean
  publicKey?: string
  token?: string
  path?: string
}

/** Current Slash Client being used to handle commands */
let client: SlashClient
/** Manage Slash Commands right in Deploy */
let commands: SlashCommandsManager

/**
 * Initialize Slash Commands Handler for [Deno Deploy](https://deno.com/deploy).
 * Easily create Serverless Slash Commands on the fly.
 *
 * **Examples**
 *
 * ```ts
 * init({
 *   publicKey: "my public key",
 *   token: "my bot's token", // only required if you want to manage slash commands in code
 * })
 * ```
 *
 * ```ts
 * // takes up `PUBLIC_KEY` and `TOKEN` from ENV
 * init({ env: true })
 * ```
 *
 * @param options Initialization options
 */
export function init(options: { env: boolean; path?: string }): void
export function init(options: {
  publicKey: string
  token?: string
  path?: string
}): void
export function init(options: DeploySlashInitOptions): void {
  console.log("init slash client");
  if (client !== undefined) throw new Error('Already initialized')
  if (options.env === true) {
    options.publicKey = Deno.env.get('PUBLIC_KEY')
    options.token = Deno.env.get('TOKEN')
  }

  if (options.publicKey === undefined)
    throw new Error('Public Key not provided')

  client = new SlashClient({
    token: options.token,
    publicKey: options.publicKey
  })

  commands = client.commands

  const cb = async (evt: {
    respondWith: CallableFunction
    request: Request
  }): Promise<void> => {
    if (options.path !== undefined) {
      if (new URL(evt.request.url).pathname !== options.path) return
    }
    console.log("==================================================================================");
    console.log("inside callback with request", evt.request.headers, evt.request.method, evt.request.json);
    try {
      // we have to wrap because there are some weird scope errors
      const d = await client.verifyFetchEvent({
        respondWith: (...args: unknown[]) => evt.respondWith(...args),
        request: evt.request
      })
      if (d === false) {
        console.log("not authorized");
        await evt.respondWith(
          new Response('Not Authorized', {
            status: 400
          })
        )
        return
      }

      if (d.type === InteractionType.PING) {
        console.log("ping request");
        await d.respond({ type: InteractionResponseType.PONG })
        client.emit('ping')
        return
      }
      console.log("now processing interaction");
      await (client as any)._process(d)
    } catch (e) {
      await client.emit('interactionError', e)
    }
  }

  addEventListener('fetch', cb as unknown as EventListener)
}

/**
 * Register Slash Command handler.
 *
 * Example:
 *
 * ```ts
 * handle("ping", (interaction) => {
 *   interaction.reply("Pong!")
 * })
 * ```
 *
 * Also supports Sub Command and Group handling out of the box!
 * ```ts
 * handle("command-name group-name sub-command", (i) => {
 *   // ...
 * })
 *
 * handle("command-name sub-command", (i) => {
 *   // ...
 * })
 * ```
 *
 * @param cmd Command to handle. Either Handler object or command name followed by handler function in next parameter.
 * @param handler Handler function (required if previous argument was command name)
 */
export function handle(
  cmd: string | SlashCommandHandler,
  handler?: SlashCommandHandlerCallback
): void {
  console.log("calling handle of command", cmd)
  if (client === undefined)
    throw new Error('Slash Client not initialized. Call `init` first')
  client.handle(cmd, handler)
}

export function interactions(cb: (i: Interaction) => any): void {
  client.on('interaction', cb)
}

export { commands, client }
export * from './src/types/slashCommands.ts'
export * from './src/types/interactions.ts'
export * from './src/structures/slash.ts'
export * from './src/interactions/mod.ts'
export * from './src/types/channel.ts'
export * from './src/structures/interactions.ts'
export * from './src/structures/message.ts'
export * from './src/structures/embed.ts'
