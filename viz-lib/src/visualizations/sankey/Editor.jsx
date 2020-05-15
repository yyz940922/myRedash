import React from "react";

export default function Editor() {
  return (
    <React.Fragment>
      <p>This visualization expects the query result to have rows in the following format:</p>
      <ul>
        <li>
          <strong>stage1</strong> - 层级1的值
        </li>
        <li>
          <strong>stage2</strong> - 层级2的值(可空)
        </li>
        <li>
          <strong>stage3</strong> - 层级3的值(可空)
        </li>
        <li>
          <strong>stage4</strong> - 层级4的值(可空)
        </li>
        <li>
          <strong>stage5</strong> - 层级5的值(可空)
        </li>
        <li>
          <strong>value</strong> - 序列数
        </li>
      </ul>
    </React.Fragment>
  );
}
