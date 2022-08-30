// 用于更新类组件的 state
import { scheduleUpdate } from "../reconciliation"

export class Component {
    constructor(props) {
        this.props = props
    }
    setState(partialState) {
        scheduleUpdate(this, partialState)
    }
}