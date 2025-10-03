// このファイルは意図的にESLintエラーを発生させます

// no-unused-vars: 未使用の変数
const unusedVariable = 'this is not used';

// no-undef: 未定義の変数
console.log(undefinedVariable);

// no-console: console文
console.log('console statement');

// semi: セミコロンがない
const noSemicolon = 'missing semicolon'

// quotes: クォートの種類が違う（設定による）
const wrongQuote = "should be single quote";

// eqeqeq: == の代わりに === を使用
if (1 == '1') {
  console.log('loose equality');
}

// no-var: var の使用
var oldStyleVar = 'use let or const';

// prefer-const: const を使うべき
let shouldBeConst = 'never reassigned';
console.log(shouldBeConst);

// no-const-assign: const への再代入
const constantValue = 'initial';
constantValue = 'reassigned';

// no-dupe-keys: 重複したキー
const obj = {
  key: 'value1',
  key: 'value2'
};

// no-duplicate-case: 重複したcase
switch (1) {
  case 1:
    break;
  case 1:
    break;
}

// no-unreachable: 到達不可能なコード
function unreachableCode() {
  return true;
  console.log('unreachable');
}

// no-empty: 空のブロック
if (true) {
}

// curly: 波括弧が必要
if (true) console.log('need curly braces');

// no-redeclare: 再宣言
let redeclaredVar = 1;
let redeclaredVar = 2;
