import { html } from 'htm/preact'
import { FunctionComponent, render } from 'preact'
import { ButtonOutline } from '@nichoth/components/htm/button-outline'
import { State, Increase, Decrease } from './state'
import '@nichoth/components/button-outline.css'
import './style.css'

const state = await State()

const ReplicacheDemo:FunctionComponent<{name:string}> = function ({ name }) {
    function plus (ev) {
        ev.preventDefault()
        Increase(state)
    }

    function minus (ev) {
        ev.preventDefault()
        Decrease(state)
    }

    return html`<div id="idbName">
        <strong>idb name</strong> ${name}

        <p>Clicked: ${state.count} times</p>

        <div>
            <${ButtonOutline} onClick=${plus}>Plus<//>
        </div>
        <div>
            <${ButtonOutline} onClick=${minus}>Minus<//>
        </div>
    </div>`
}

render(html`<${ReplicacheDemo} name=${state.name} />`,
    document.getElementById('root')!)
