import { html } from 'htm/preact'
import { useMemo } from 'preact/hooks'
import { FunctionComponent, render } from 'preact'
import { Replicache } from 'replicache'
import { ButtonOutline } from '@nichoth/components/htm/button-outline'
import { signal } from '@preact/signals'
import { initSpace } from './space.js'
import { TUTORIAL_LICENSE_KEY } from './license.js'
import '@nichoth/components/button-outline.css'
import './style.css'

/**
 * Replicache can sync with any server that implements the Replicache
 * sync protocol. You can learn how to build such a server in the
 * [BYOB Tutorial](https://doc.replicache.dev/byob/intro).
 *
 * For now, we’ll just connect to an existing server by adding `pushURL` and
 * `pullURL` parameters to the constructor.
 */

const serverURL = 'https://replicache-counter-pr-6.onrender.com'
const spaceID = await initSpace(serverURL)

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
        }
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

const ReplicacheDemo:FunctionComponent<{name:string}> = function ({ name }) {
    const count = useMemo(() => {
        const countSignal = signal<number|null>(null)

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

        return countSignal
    }, [])

    function plus (ev) {
        ev.preventDefault()
        rep.mutate.increment(1)
    }

    return html`<div id="idbName">
        <strong>idb name</strong> ${name}

        <p>Clicked: ${count} times</p>

        <div>
            <${ButtonOutline} onClick=${plus}>Plus<//>
        </div>
    </div>`
}

render(html`<${ReplicacheDemo} name=${rep.idbName} />`,
    document.getElementById('root')!)
