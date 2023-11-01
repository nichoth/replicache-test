import { Signal, signal } from '@preact/signals'
import Route from 'route-event'
import { Replicache } from 'replicache'
import { TUTORIAL_LICENSE_KEY } from './license.js'

/**
 * Setup any app state
 *   - routes
 *   - reflect
 */
export async function State ():Promise<{
    route:Signal<string>;
    count:Signal<number>;
    name:Signal<string>;
    _replicache:InstanceType<typeof Replicache>;
    _setRoute:(path:string)=>void;
}> {
    const onRoute = Route()
    const serverURL = 'https://replicache-counter-pr-6.onrender.com'
    const spaceID = await initSpace(serverURL, onRoute.setRoute.bind(onRoute))
    console.log('space id...', spaceID)

    const rep = new Replicache({
        name: 'alice',
        licenseKey: TUTORIAL_LICENSE_KEY,
        pushURL: `${serverURL}/api/replicache/push?spaceID=${spaceID}`,
        pullURL: `${serverURL}/api/replicache/pull?spaceID=${spaceID}`,

        /**
         * Mutators are arbitrary functions that run once on the client
         * immediately (aka “optimistically”), and then run again later on the
         * server (”authoritatively”) during sync.
         */
        mutators: {
            increment: async (tx, delta) => {
                // Despite 'await', this get almost always responds instantly.
                // Same with `put` below.
                const prev = (await tx.get('count')) ?? 0
                const next = prev + delta
                await tx.put('count', next)
                return next
            },

            decrement: async (tx, delta) => {
                const prev = (await tx.get('count')) ?? 0
                const next = prev - delta
                await tx.put('count', next)
                return next
            }
        }
    })

    const nameSignal = signal<string>('alice')
    const countSignal = signal<number>(0)

    /**
     * You can subscribe to a query of Replicache and you will get notified
     * when that query changes for any reason — either because of local
     * optimistic changes, or because of sync.
     */
    rep.subscribe(async (tx) => (await tx.get('count')) ?? 0, {
        onData: (n) => {
            countSignal.value = (n as number)
        }
    })

    // Implements a Replicache poke using Server-Sent Events.
    // If a "poke" message is received, it will pull from the server.
    const ev = new EventSource(
        serverURL + '/api/replicache/poke?spaceID=' + spaceID, {
            withCredentials: false
        }
    )
    ev.onmessage = async (event) => {
        if (event.data === 'poke') {
            await rep.pull()
        }
    }

    const state = {
        _setRoute: onRoute.setRoute.bind(onRoute),
        _replicache: rep,
        name: nameSignal,
        count: countSignal,
        route: signal<string>(location.pathname + location.search)
    }

    /**
     * Set the app state to match the browser URL
     */
    onRoute((path:string) => {
        // for github pages
        const newPath = path.replace('/replicache-test/', '/')
        state.route.value = newPath
    })

    return state
}

/**
 * Our state update functions only call methods on the reflect object. We don't
 * set our UI state manuallyThe
 * reflect object has methods from the mutators that we passed in earlier.
 *
 * The UI hears the state change because we subscribed to any changes in
 * reflect's state in the constructor.
 */
export function Increase (state:Awaited<ReturnType<typeof State>>) {
    console.log('increase')
    state._replicache.mutate.increment(1)
}

export function Decrease (state:Awaited<ReturnType<typeof State>>) {
    console.log('decrement')
    state._replicache.mutate.decrement(1)
}

export async function initSpace (serverURL, setRoute):Promise<string> {
    const { pathname } = window.location
    const paths = pathname.split('/').filter(Boolean)
    const [spaceDir, spaceID] = paths

    if (spaceDir === 'space' && spaceID) {
        if (await spaceExists(serverURL, spaceID)) {
            return spaceID
        }
    }

    const newSpaceID = await createSpace(serverURL)
    setRoute(`/space/${newSpaceID}`)
    // window.history.pushState(null, '', `/space/${newSpaceID}`)
    return newSpaceID
}

async function spaceExists (serverURL, spaceID) {
    const spaceExistRes = await fetchJSON(serverURL, 'spaceExists', spaceID)
    return spaceExistRes.spaceExists
}

async function createSpace (serverURL) {
    const createSpaceRes = await fetchJSON(serverURL, 'createSpace')
    return createSpaceRes.spaceID
}

async function fetchJSON (serverURL, apiName, spaceID?) {
    const res = await fetch(`${serverURL}/api/replicache/${apiName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            spaceID
        })
    })
    return await res.json()
}
