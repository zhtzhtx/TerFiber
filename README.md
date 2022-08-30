# TerFiber

各位好，这是一个学习项目，博文地址：[https://juejin.cn/post/7137679011416637447/](https://juejin.cn/post/7137679011416637447/)

上篇我们介绍了 React 的实现思路，但并没有讲 React 中非常关键的 Fiber 结构，今天就来作一篇 Fiber 的学习笔记。

在 React 16 之前更新 Virtual DOM 的过程是采用循环加递归实现的，这种比对方式有一个问题，就是一旦任务开始进行就无法中断，如果应用中组件数量庞大，主线程被长期占用，直到整棵 VirtualDOM 树比对更新完成之后主线程才能被释放，主线程才能执行其他任务。这就会导致一些用户交互，动画等任务无法立即得到执行，页面就会产生卡顿, 非常的影响用户体验。

为了解决这个问题，React 16 之后开始使用 Fiber 结构。在 Fiber 结构中，为了实现任务的终止再继续，放弃递归只采用循环，因为循环可以被中断，然后将任务拆分成一个个的小任务，利用浏览器空闲时间执行任务，拒绝长时间占用主线程。


希望这个项目能给大家带来帮助。
