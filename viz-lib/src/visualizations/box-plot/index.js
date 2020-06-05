import Renderer from "./Renderer";
import Editor from "./Editor";

export default {
  type: "BOXPLOT",
  name: "箱形图(Boxplot Deprecated)",
  isDeprecated: true,
  getOptions: options => ({ ...options }),
  Renderer,
  Editor,

  defaultRows: 8,
  minRows: 5,
};
