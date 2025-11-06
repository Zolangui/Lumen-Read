export interface INode {
  id: string
  parent?: string
  subitems?: readonly INode[]
  depth?: number
  expanded?: boolean
}

export function dfs<T extends INode>(
  node: T,
  cb: (node: T) => void,
  depth = 0,
) {
  node.depth = depth
  cb(node)
  if (node.subitems) {
    node.subitems.forEach((n) => dfs(n as T, cb, depth + 1))
  }
}

export function flatTree<T extends INode>(
  node: T,
  depth = 0,
  expandedState: Record<string, boolean> = {},
): T[] {
  const newNode = {
    ...node,
    depth,
    expanded: expandedState[node.id] ?? false,
  }

  const children = newNode.expanded
    ? newNode.subitems?.flatMap((n) =>
        flatTree(n as T, depth + 1, expandedState),
      )
    : undefined

  return [newNode, ...(children ?? [])]
}
