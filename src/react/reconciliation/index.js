import { updateNodeElement } from "../DOM"
import { createTaskQueue, arrified, createStateNode, getTag, getRoot } from "../Misc"

// 创建任务队列
const taskQueue = createTaskQueue()

// 初始化当前任务
let subTask = null
// 等待渲染到页面的 fiber 对象
let pendingCommit = null

const commitAllWork = fiber => {
    fiber.effects.forEach(item => {
        if (item.tag === "class_component") {
            item.stateNode.__fiber = item
        }
        if (item.effectTag === "delete") {
            item.parent.stateNode.removeChild(item.stateNode)
        } else if (item.effectTag === "update") {
            // 更新
            if (item.type === item.alternate.type) {
                // 节点类型相同
                updateNodeElement(item.stateNode, item, item.alternate)
            } else {
                // 节点类型不同
                item.parent.stateNode.replaceChild(
                    item.stateNode,
                    item.alternate.stateNode
                )
            }
        } else if (item.effectTag === "placement") {
            let fiber = item
            let parentFiber = item.parent
            while (parentFiber.tag === "class_component" || parentFiber.tag === "function_component") {
                parentFiber = parentFiber.parent
            }
            if (fiber.tag === "host_component") {
                parentFiber.stateNode.appendChild(fiber.stateNode)
            }
        }
    })
    // 备份旧的 Fiber 对象
    fiber.stateNode.__rootFiberContainer = fiber
}


const getFirstTask = () => {
    // 从任务队列中获取任务
    const task = taskQueue.pop()

    if (task.from === "class_component") {
        const root = getRoot(task.instance)
        task.instance.__fiber.partialState = task.partialState
        return {
            props: root.props,
            stateNode: root.stateNode,
            tag: "host_root",
            effects: [],
            child: null,
            alternate: root
        }
    }

    // 返回最外层节点的fiber对象
    return {
        props: task.props, // 节点属性
        stateNode: task.dom, // 节点 DOM 对象 | 组件实例对象
        tag: "host_root", // 节点标记
        effects: [], // 数组, 存储需要更改的 fiber 对象
        child: null, //当前 Fiber 的子级 Fiber
        alternate: task.dom.__rootFiberContainer // Fiber 备份 fiber 比对时使用
    }
}

const reconcileChildren = (fiber, children) => {
    // children可能是对象也可能是数组
    // 将children转化成数组
    const arrifiedChildren = arrified(children)

    // 循环 children 使用的索引
    let index = 0
    // children 数组中元素的个数
    let numberOfElements = arrifiedChildren.length
    // 循环过程中的循环项 就是子节点的 virtualDOM 对象
    let element = null
    // 子级 fiber 对象
    let newFiber = null
    // 上一个兄弟 fiber 对象
    let preFiber = null
    // 旧 fiber 对象的子节点
    let alternate = null
    if (fiber.alternate && fiber.alternate.child) {
        alternate = fiber.alternate.child
    }

    // 通过 alternate 是否存在判断是否为删除操作
    while (index < numberOfElements || alternate) {
        // 子级 virtualDOM 对象
        element = arrifiedChildren[index]
        if (!element && alternate) {
            // 删除操作
            alternate.effectTag = "delete"
            fiber.effects.push(alternate)
        } else if (element && alternate) {
            // 更新操作
            newFiber = {
                type: element.type,
                props: element.props,
                tag: getTag(element),
                effects: [],
                effectTag: "update",
                parent: fiber,
                alternate
            }
            if (element.type === alternate.type) {
                // 类型相同
                newFiber.stateNode = alternate.stateNode
            } else {
                // 类型不同
                newFiber.stateNode = createStateNode(newFiber)
            }
        } else if (element && !alternate) {
            // 初始渲染
            // 子级 fiber 对象
            newFiber = {
                type: element.type,
                props: element.props,
                tag: getTag(element),
                effects: [],
                effectTag: "placement",
                parent: fiber
            }
            // 为fiber节点添加DOM对象或组件实例对象
            newFiber.stateNode = createStateNode(newFiber)
        }


        // 为父级 fiber 添加子级 fiber
        if (index === 0) {
            fiber.child = newFiber
        } else if (element) {
            // 为fiber添加下一个兄弟fiber
            preFiber.sibling = newFiber
        }

        // 如果旧 fiber 对象存在且其有兄弟节点，则将 alternate 的值更新
        if (alternate && alternate.sibling) {
            alternate = alternate.sibling
        } else {
            alternate = null
        }

        preFiber = newFiber

        index++
    }
}

const executeTask = fiber => {
    // 构建子级fiber对象
    if (fiber.tag === "class_component") {
        if (fiber.stateNode.__fiber && fiber.stateNode.__fiber.partialState) {
            fiber.stateNode.state = {
                ...fiber.stateNode.state,
                ...fiber.stateNode.__fiber.partialState
            }
        }
        reconcileChildren(fiber, fiber.stateNode.render())
    } else if (fiber.tag === "function_component") {
        reconcileChildren(fiber, fiber.stateNode(fiber.props))
    } else {
        reconcileChildren(fiber, fiber.props.children)
    }

    // 如果 fiber 有子级，则将子级返回给 subTask，形成递归构建子级节点
    if (fiber.child) {
        return fiber.child
    }

    // 获取当前构建的 fiber 节点
    let currentExecutelyFiber = fiber

    while (currentExecutelyFiber.parent) {
        // 构建 fiber 对象时将其添加到自己的 effect 数组中，然后将 effect 数组同父级的 effect 数组进行合并，这样依次合并到根节点。
        currentExecutelyFiber.parent.effects = currentExecutelyFiber.parent.effects.concat(
            currentExecutelyFiber.effects.concat([currentExecutelyFiber])
        )
        // 如果 fiber 节点有兄弟节点，则将兄弟节点返回给 subTask，形成递归构建兄弟节点
        if (currentExecutelyFiber.sibling) {
            return currentExecutelyFiber.sibling
        }
        // 否则判断是否需要构建父级的兄弟节点
        currentExecutelyFiber = currentExecutelyFiber.parent
    }
    pendingCommit = currentExecutelyFiber
}

// 任务循环
const workLoop = deadline => {
    // 如果子任务不存在，就去获取子任务
    if (!subTask) {
        subTask = getFirstTask()
    }
    // 如果任务存在并且浏览器有空闲时间就调用
    // executeTask 方法执行任务 接受任务 返回新的任务
    while (subTask && deadline.timeRemaining() > 1) {
        subTask = executeTask(subTask)
    }
    // 如果当前 pendingCommit 变量有值
    if (pendingCommit) {
        // 说明当前有 fiber 对象等待渲染到页面上，调用 commitAllWork 方法将其渲染到页面上
        commitAllWork(pendingCommit)
    }
}

const performTask = deadline => {
    // 执行任务
    workLoop(deadline)
    // 判断任务是否存在
    // 判断任务队列中是否还有任务没有执行
    if (subTask || !taskQueue.isEmpty()) {
        // 再一次告诉浏览器在空闲的时间执行任务
        requestIdleCallback(performTask)
    }
}

export const render = (element, dom) => {
    /**
     *  1. 向任务队列中添加任务
     *  2. 指定在浏览器空闲时间时执行任务
     */
    taskQueue.push({
        dom,
        props: { children: element }
    })
    requestIdleCallback(performTask)
}

export const scheduleUpdate = (instance, partialState) => {
    taskQueue.push({
        from: "class_component",
        instance,
        partialState // 新的 state 数据
    })
    requestIdleCallback(performTask)
}