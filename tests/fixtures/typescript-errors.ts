// このファイルは意図的にTypeScriptのESLintエラーを発生させます

// @typescript-eslint/no-unused-vars: 未使用の変数
const unusedTsVariable = 'this is not used';

// @typescript-eslint/no-explicit-any: any型の使用
function acceptAny(param: any): any {
  return param;
}

// @typescript-eslint/explicit-function-return-type: 戻り値の型が明示されていない
function noReturnType(x: number, y: number) {
  return x + y;
}

// @typescript-eslint/no-inferrable-types: 推論可能な型注釈
const inferrableNumber: number = 10;
const inferrableString: string = 'hello';

// @typescript-eslint/ban-ts-comment: @ts-ignore等の使用
// @ts-ignore
const ignoredError = undefinedValue;

// @typescript-eslint/no-empty-interface: 空のインターフェース
interface EmptyInterface {}

interface EmptyWithExtends extends Record<string, unknown> {}

// @typescript-eslint/no-var-requires: require文の使用
const module = require('module');

// @typescript-eslint/prefer-as-const: as constを使うべき
const literal = 'literal' as 'literal';

// @typescript-eslint/prefer-namespace-keyword: moduleではなくnamespaceを使用
module MyModule {
  export const value = 1;
}

// @typescript-eslint/no-namespace: 名前空間の使用
namespace CustomNamespace {
  export const value = 1;
}

// @typescript-eslint/adjacent-overload-signatures: オーバーロードが隣接していない
function overloaded(x: number): number;
function anotherFunction(): void {}
function overloaded(x: string): string;
function overloaded(x: number | string): number | string {
  return x;
}

// @typescript-eslint/array-type: 配列型の記述方法（設定による）
const arrayGeneric: Array<number> = [1, 2, 3];
const arrayBracket: number[] = [1, 2, 3];

// @typescript-eslint/consistent-type-definitions: typeとinterfaceの使い分け（設定による）
type TypeDefinition = {
  prop: string;
};

interface InterfaceDefinition {
  prop: string;
}

// @typescript-eslint/no-non-null-assertion: 非nullアサーション
const maybeNull: string | null = 'value';
const definitelyString = maybeNull!;

// @typescript-eslint/prefer-optional-chain: オプショナルチェーンを使うべき
const obj = { nested: { value: 'test' } };
const value = obj && obj.nested && obj.nested.value;
