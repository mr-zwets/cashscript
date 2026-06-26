// Generated from src/grammar/CashScript.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols

import {
	ATN,
	ATNDeserializer, DecisionState, DFA, FailedPredicateException,
	RecognitionException, NoViableAltException, BailErrorStrategy,
	Parser, ParserATNSimulator,
	RuleContext, ParserRuleContext, PredictionMode, PredictionContextCache,
	TerminalNode, RuleNode,
	Token, TokenStream,
	Interval, IntervalSet
} from 'antlr4';
import CashScriptVisitor from "./CashScriptVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;

export default class CashScriptParser extends Parser {
	public static readonly T__0 = 1;
	public static readonly T__1 = 2;
	public static readonly T__2 = 3;
	public static readonly T__3 = 4;
	public static readonly T__4 = 5;
	public static readonly T__5 = 6;
	public static readonly T__6 = 7;
	public static readonly T__7 = 8;
	public static readonly T__8 = 9;
	public static readonly T__9 = 10;
	public static readonly T__10 = 11;
	public static readonly T__11 = 12;
	public static readonly T__12 = 13;
	public static readonly T__13 = 14;
	public static readonly T__14 = 15;
	public static readonly T__15 = 16;
	public static readonly T__16 = 17;
	public static readonly T__17 = 18;
	public static readonly T__18 = 19;
	public static readonly T__19 = 20;
	public static readonly T__20 = 21;
	public static readonly T__21 = 22;
	public static readonly T__22 = 23;
	public static readonly T__23 = 24;
	public static readonly T__24 = 25;
	public static readonly T__25 = 26;
	public static readonly T__26 = 27;
	public static readonly T__27 = 28;
	public static readonly T__28 = 29;
	public static readonly T__29 = 30;
	public static readonly T__30 = 31;
	public static readonly T__31 = 32;
	public static readonly T__32 = 33;
	public static readonly T__33 = 34;
	public static readonly T__34 = 35;
	public static readonly T__35 = 36;
	public static readonly T__36 = 37;
	public static readonly T__37 = 38;
	public static readonly T__38 = 39;
	public static readonly T__39 = 40;
	public static readonly T__40 = 41;
	public static readonly T__41 = 42;
	public static readonly T__42 = 43;
	public static readonly T__43 = 44;
	public static readonly T__44 = 45;
	public static readonly T__45 = 46;
	public static readonly T__46 = 47;
	public static readonly T__47 = 48;
	public static readonly T__48 = 49;
	public static readonly T__49 = 50;
	public static readonly T__50 = 51;
	public static readonly T__51 = 52;
	public static readonly T__52 = 53;
	public static readonly T__53 = 54;
	public static readonly T__54 = 55;
	public static readonly T__55 = 56;
	public static readonly T__56 = 57;
	public static readonly T__57 = 58;
	public static readonly T__58 = 59;
	public static readonly T__59 = 60;
	public static readonly T__60 = 61;
	public static readonly T__61 = 62;
	public static readonly T__62 = 63;
	public static readonly T__63 = 64;
	public static readonly VersionLiteral = 65;
	public static readonly BooleanLiteral = 66;
	public static readonly NumberUnit = 67;
	public static readonly NumberLiteral = 68;
	public static readonly NumberPart = 69;
	public static readonly ExponentPart = 70;
	public static readonly PrimitiveType = 71;
	public static readonly UnboundedBytes = 72;
	public static readonly BoundedBytes = 73;
	public static readonly Bound = 74;
	public static readonly StringLiteral = 75;
	public static readonly DateLiteral = 76;
	public static readonly HexLiteral = 77;
	public static readonly TxVar = 78;
	public static readonly UnsafeCast = 79;
	public static readonly NullaryOp = 80;
	public static readonly Internal = 81;
	public static readonly Library = 82;
	public static readonly Import = 83;
	public static readonly Identifier = 84;
	public static readonly WHITESPACE = 85;
	public static readonly COMMENT = 86;
	public static readonly LINE_COMMENT = 87;
	public static override readonly EOF = Token.EOF;
	public static readonly RULE_sourceFile = 0;
	public static readonly RULE_topLevelDefinition = 1;
	public static readonly RULE_importDirective = 2;
	public static readonly RULE_pragmaDirective = 3;
	public static readonly RULE_pragmaName = 4;
	public static readonly RULE_pragmaValue = 5;
	public static readonly RULE_versionConstraint = 6;
	public static readonly RULE_versionOperator = 7;
	public static readonly RULE_contractDefinition = 8;
	public static readonly RULE_libraryDefinition = 9;
	public static readonly RULE_libraryMember = 10;
	public static readonly RULE_constantDefinition = 11;
	public static readonly RULE_functionDefinition = 12;
	public static readonly RULE_functionBody = 13;
	public static readonly RULE_parameterList = 14;
	public static readonly RULE_parameter = 15;
	public static readonly RULE_block = 16;
	public static readonly RULE_statement = 17;
	public static readonly RULE_nonControlStatement = 18;
	public static readonly RULE_functionCallStatement = 19;
	public static readonly RULE_returnStatement = 20;
	public static readonly RULE_controlStatement = 21;
	public static readonly RULE_variableDefinition = 22;
	public static readonly RULE_tupleAssignment = 23;
	public static readonly RULE_tupleTarget = 24;
	public static readonly RULE_assignStatement = 25;
	public static readonly RULE_timeOpStatement = 26;
	public static readonly RULE_requireStatement = 27;
	public static readonly RULE_consoleStatement = 28;
	public static readonly RULE_ifStatement = 29;
	public static readonly RULE_loopStatement = 30;
	public static readonly RULE_doWhileStatement = 31;
	public static readonly RULE_whileStatement = 32;
	public static readonly RULE_forStatement = 33;
	public static readonly RULE_forInit = 34;
	public static readonly RULE_requireMessage = 35;
	public static readonly RULE_consoleParameter = 36;
	public static readonly RULE_consoleParameterList = 37;
	public static readonly RULE_functionCall = 38;
	public static readonly RULE_expressionList = 39;
	public static readonly RULE_expression = 40;
	public static readonly RULE_modifier = 41;
	public static readonly RULE_literal = 42;
	public static readonly RULE_numberLiteral = 43;
	public static readonly RULE_typeName = 44;
	public static readonly RULE_typeCast = 45;
	public static readonly literalNames: (string | null)[] = [ null, "';'", 
                                                            "'pragma'", 
                                                            "'cashscript'", 
                                                            "'^'", "'~'", 
                                                            "'>='", "'>'", 
                                                            "'<'", "'<='", 
                                                            "'='", "'contract'", 
                                                            "'{'", "'}'", 
                                                            "'constant'", 
                                                            "'function'", 
                                                            "'returns'", 
                                                            "'('", "','", 
                                                            "')'", "'return'", 
                                                            "'+='", "'-='", 
                                                            "'++'", "'--'", 
                                                            "'require'", 
                                                            "'console.log'", 
                                                            "'if'", "'else'", 
                                                            "'do'", "'while'", 
                                                            "'for'", "'new'", 
                                                            "'['", "']'", 
                                                            "'tx.outputs'", 
                                                            "'.value'", 
                                                            "'.lockingBytecode'", 
                                                            "'.tokenCategory'", 
                                                            "'.nftCommitment'", 
                                                            "'.tokenAmount'", 
                                                            "'tx.inputs'", 
                                                            "'.outpointTransactionHash'", 
                                                            "'.outpointIndex'", 
                                                            "'.unlockingBytecode'", 
                                                            "'.sequenceNumber'", 
                                                            "'.reverse()'", 
                                                            "'.length'", 
                                                            "'.split'", 
                                                            "'.slice'", 
                                                            "'!'", "'-'", 
                                                            "'*'", "'/'", 
                                                            "'%'", "'+'", 
                                                            "'>>'", "'<<'", 
                                                            "'=='", "'!='", 
                                                            "'&'", "'|'", 
                                                            "'&&'", "'||'", 
                                                            "'unused'", 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            null, "'bytes'", 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            null, null, 
                                                            "'internal'", 
                                                            "'library'", 
                                                            "'import'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, "VersionLiteral", 
                                                             "BooleanLiteral", 
                                                             "NumberUnit", 
                                                             "NumberLiteral", 
                                                             "NumberPart", 
                                                             "ExponentPart", 
                                                             "PrimitiveType", 
                                                             "UnboundedBytes", 
                                                             "BoundedBytes", 
                                                             "Bound", "StringLiteral", 
                                                             "DateLiteral", 
                                                             "HexLiteral", 
                                                             "TxVar", "UnsafeCast", 
                                                             "NullaryOp", 
                                                             "Internal", 
                                                             "Library", 
                                                             "Import", "Identifier", 
                                                             "WHITESPACE", 
                                                             "COMMENT", 
                                                             "LINE_COMMENT" ];
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"sourceFile", "topLevelDefinition", "importDirective", "pragmaDirective", 
		"pragmaName", "pragmaValue", "versionConstraint", "versionOperator", "contractDefinition", 
		"libraryDefinition", "libraryMember", "constantDefinition", "functionDefinition", 
		"functionBody", "parameterList", "parameter", "block", "statement", "nonControlStatement", 
		"functionCallStatement", "returnStatement", "controlStatement", "variableDefinition", 
		"tupleAssignment", "tupleTarget", "assignStatement", "timeOpStatement", 
		"requireStatement", "consoleStatement", "ifStatement", "loopStatement", 
		"doWhileStatement", "whileStatement", "forStatement", "forInit", "requireMessage", 
		"consoleParameter", "consoleParameterList", "functionCall", "expressionList", 
		"expression", "modifier", "literal", "numberLiteral", "typeName", "typeCast",
	];
	public get grammarFileName(): string { return "CashScript.g4"; }
	public get literalNames(): (string | null)[] { return CashScriptParser.literalNames; }
	public get symbolicNames(): (string | null)[] { return CashScriptParser.symbolicNames; }
	public get ruleNames(): string[] { return CashScriptParser.ruleNames; }
	public get serializedATN(): number[] { return CashScriptParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(this, CashScriptParser._ATN, CashScriptParser.DecisionsToDFA, new PredictionContextCache());
	}
	// @RuleVersion(0)
	public sourceFile(): SourceFileContext {
		let localctx: SourceFileContext = new SourceFileContext(this, this._ctx, this.state);
		this.enterRule(localctx, 0, CashScriptParser.RULE_sourceFile);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 95;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===2) {
				{
				{
				this.state = 92;
				this.pragmaDirective();
				}
				}
				this.state = 97;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 101;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===11 || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 6151) !== 0)) {
				{
				{
				this.state = 98;
				this.topLevelDefinition();
				}
				}
				this.state = 103;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 104;
			this.match(CashScriptParser.EOF);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public topLevelDefinition(): TopLevelDefinitionContext {
		let localctx: TopLevelDefinitionContext = new TopLevelDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 2, CashScriptParser.RULE_topLevelDefinition);
		try {
			this.state = 110;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 83:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 106;
				this.importDirective();
				}
				break;
			case 71:
			case 72:
			case 73:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 107;
				this.constantDefinition();
				}
				break;
			case 82:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 108;
				this.libraryDefinition();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 109;
				this.contractDefinition();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public importDirective(): ImportDirectiveContext {
		let localctx: ImportDirectiveContext = new ImportDirectiveContext(this, this._ctx, this.state);
		this.enterRule(localctx, 4, CashScriptParser.RULE_importDirective);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 112;
			this.match(CashScriptParser.Import);
			this.state = 113;
			this.match(CashScriptParser.StringLiteral);
			this.state = 114;
			this.match(CashScriptParser.T__0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public pragmaDirective(): PragmaDirectiveContext {
		let localctx: PragmaDirectiveContext = new PragmaDirectiveContext(this, this._ctx, this.state);
		this.enterRule(localctx, 6, CashScriptParser.RULE_pragmaDirective);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 116;
			this.match(CashScriptParser.T__1);
			this.state = 117;
			this.pragmaName();
			this.state = 118;
			this.pragmaValue();
			this.state = 119;
			this.match(CashScriptParser.T__0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public pragmaName(): PragmaNameContext {
		let localctx: PragmaNameContext = new PragmaNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 8, CashScriptParser.RULE_pragmaName);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 121;
			this.match(CashScriptParser.T__2);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public pragmaValue(): PragmaValueContext {
		let localctx: PragmaValueContext = new PragmaValueContext(this, this._ctx, this.state);
		this.enterRule(localctx, 10, CashScriptParser.RULE_pragmaValue);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 123;
			this.versionConstraint();
			this.state = 125;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2032) !== 0) || _la===65) {
				{
				this.state = 124;
				this.versionConstraint();
				}
			}

			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public versionConstraint(): VersionConstraintContext {
		let localctx: VersionConstraintContext = new VersionConstraintContext(this, this._ctx, this.state);
		this.enterRule(localctx, 12, CashScriptParser.RULE_versionConstraint);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 128;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2032) !== 0)) {
				{
				this.state = 127;
				this.versionOperator();
				}
			}

			this.state = 130;
			this.match(CashScriptParser.VersionLiteral);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public versionOperator(): VersionOperatorContext {
		let localctx: VersionOperatorContext = new VersionOperatorContext(this, this._ctx, this.state);
		this.enterRule(localctx, 14, CashScriptParser.RULE_versionOperator);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 132;
			_la = this._input.LA(1);
			if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 2032) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public contractDefinition(): ContractDefinitionContext {
		let localctx: ContractDefinitionContext = new ContractDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 16, CashScriptParser.RULE_contractDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 134;
			this.match(CashScriptParser.T__10);
			this.state = 135;
			this.match(CashScriptParser.Identifier);
			this.state = 136;
			this.parameterList();
			this.state = 137;
			this.match(CashScriptParser.T__11);
			this.state = 141;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===15 || _la===81) {
				{
				{
				this.state = 138;
				this.functionDefinition();
				}
				}
				this.state = 143;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 144;
			this.match(CashScriptParser.T__12);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public libraryDefinition(): LibraryDefinitionContext {
		let localctx: LibraryDefinitionContext = new LibraryDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 18, CashScriptParser.RULE_libraryDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 146;
			this.match(CashScriptParser.Library);
			this.state = 147;
			this.match(CashScriptParser.Identifier);
			this.state = 148;
			this.match(CashScriptParser.T__11);
			this.state = 152;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===15 || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1031) !== 0)) {
				{
				{
				this.state = 149;
				this.libraryMember();
				}
				}
				this.state = 154;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 155;
			this.match(CashScriptParser.T__12);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public libraryMember(): LibraryMemberContext {
		let localctx: LibraryMemberContext = new LibraryMemberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 20, CashScriptParser.RULE_libraryMember);
		try {
			this.state = 159;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 71:
			case 72:
			case 73:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 157;
				this.constantDefinition();
				}
				break;
			case 15:
			case 81:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 158;
				this.functionDefinition();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public constantDefinition(): ConstantDefinitionContext {
		let localctx: ConstantDefinitionContext = new ConstantDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 22, CashScriptParser.RULE_constantDefinition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 161;
			this.typeName();
			this.state = 162;
			this.match(CashScriptParser.T__13);
			this.state = 163;
			this.match(CashScriptParser.Identifier);
			this.state = 164;
			this.match(CashScriptParser.T__9);
			this.state = 165;
			this.expression(0);
			this.state = 166;
			this.match(CashScriptParser.T__0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public functionDefinition(): FunctionDefinitionContext {
		let localctx: FunctionDefinitionContext = new FunctionDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 24, CashScriptParser.RULE_functionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 169;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===81) {
				{
				this.state = 168;
				this.match(CashScriptParser.Internal);
				}
			}

			this.state = 171;
			this.match(CashScriptParser.T__14);
			this.state = 172;
			this.match(CashScriptParser.Identifier);
			this.state = 173;
			this.parameterList();
			this.state = 186;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===16) {
				{
				this.state = 174;
				this.match(CashScriptParser.T__15);
				this.state = 175;
				this.match(CashScriptParser.T__16);
				this.state = 176;
				this.typeName();
				this.state = 181;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===18) {
					{
					{
					this.state = 177;
					this.match(CashScriptParser.T__17);
					this.state = 178;
					this.typeName();
					}
					}
					this.state = 183;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 184;
				this.match(CashScriptParser.T__18);
				}
			}

			this.state = 188;
			this.functionBody();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public functionBody(): FunctionBodyContext {
		let localctx: FunctionBodyContext = new FunctionBodyContext(this, this._ctx, this.state);
		this.enterRule(localctx, 26, CashScriptParser.RULE_functionBody);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 190;
			this.match(CashScriptParser.T__11);
			this.state = 194;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3994157056) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 8199) !== 0)) {
				{
				{
				this.state = 191;
				this.statement();
				}
				}
				this.state = 196;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 197;
			this.match(CashScriptParser.T__12);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public parameterList(): ParameterListContext {
		let localctx: ParameterListContext = new ParameterListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 28, CashScriptParser.RULE_parameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 199;
			this.match(CashScriptParser.T__16);
			this.state = 211;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 7) !== 0)) {
				{
				this.state = 200;
				this.parameter();
				this.state = 205;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 12, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 201;
						this.match(CashScriptParser.T__17);
						this.state = 202;
						this.parameter();
						}
						}
					}
					this.state = 207;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 12, this._ctx);
				}
				this.state = 209;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===18) {
					{
					this.state = 208;
					this.match(CashScriptParser.T__17);
					}
				}

				}
			}

			this.state = 213;
			this.match(CashScriptParser.T__18);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public parameter(): ParameterContext {
		let localctx: ParameterContext = new ParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 30, CashScriptParser.RULE_parameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 215;
			this.typeName();
			this.state = 219;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===14 || _la===64) {
				{
				{
				this.state = 216;
				this.modifier();
				}
				}
				this.state = 221;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 222;
			this.match(CashScriptParser.Identifier);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public block(): BlockContext {
		let localctx: BlockContext = new BlockContext(this, this._ctx, this.state);
		this.enterRule(localctx, 32, CashScriptParser.RULE_block);
		let _la: number;
		try {
			this.state = 233;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 12:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 224;
				this.match(CashScriptParser.T__11);
				this.state = 228;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3994157056) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 8199) !== 0)) {
					{
					{
					this.state = 225;
					this.statement();
					}
					}
					this.state = 230;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 231;
				this.match(CashScriptParser.T__12);
				}
				break;
			case 17:
			case 20:
			case 25:
			case 26:
			case 27:
			case 29:
			case 30:
			case 31:
			case 71:
			case 72:
			case 73:
			case 84:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 232;
				this.statement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public statement(): StatementContext {
		let localctx: StatementContext = new StatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 34, CashScriptParser.RULE_statement);
		try {
			this.state = 239;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 27:
			case 29:
			case 30:
			case 31:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 235;
				this.controlStatement();
				}
				break;
			case 17:
			case 20:
			case 25:
			case 26:
			case 71:
			case 72:
			case 73:
			case 84:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 236;
				this.nonControlStatement();
				this.state = 237;
				this.match(CashScriptParser.T__0);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public nonControlStatement(): NonControlStatementContext {
		let localctx: NonControlStatementContext = new NonControlStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 36, CashScriptParser.RULE_nonControlStatement);
		try {
			this.state = 249;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 19, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 241;
				this.variableDefinition();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 242;
				this.tupleAssignment();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 243;
				this.assignStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 244;
				this.timeOpStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 245;
				this.requireStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 246;
				this.functionCallStatement();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 247;
				this.consoleStatement();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 248;
				this.returnStatement();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public functionCallStatement(): FunctionCallStatementContext {
		let localctx: FunctionCallStatementContext = new FunctionCallStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 38, CashScriptParser.RULE_functionCallStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 251;
			this.functionCall();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public returnStatement(): ReturnStatementContext {
		let localctx: ReturnStatementContext = new ReturnStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 40, CashScriptParser.RULE_returnStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 253;
			this.match(CashScriptParser.T__19);
			this.state = 254;
			this.expression(0);
			this.state = 259;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===18) {
				{
				{
				this.state = 255;
				this.match(CashScriptParser.T__17);
				this.state = 256;
				this.expression(0);
				}
				}
				this.state = 261;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public controlStatement(): ControlStatementContext {
		let localctx: ControlStatementContext = new ControlStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 42, CashScriptParser.RULE_controlStatement);
		try {
			this.state = 264;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 27:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 262;
				this.ifStatement();
				}
				break;
			case 29:
			case 30:
			case 31:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 263;
				this.loopStatement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public variableDefinition(): VariableDefinitionContext {
		let localctx: VariableDefinitionContext = new VariableDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 44, CashScriptParser.RULE_variableDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 266;
			this.typeName();
			this.state = 270;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===14 || _la===64) {
				{
				{
				this.state = 267;
				this.modifier();
				}
				}
				this.state = 272;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 273;
			this.match(CashScriptParser.Identifier);
			this.state = 274;
			this.match(CashScriptParser.T__9);
			this.state = 275;
			this.expression(0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public tupleAssignment(): TupleAssignmentContext {
		let localctx: TupleAssignmentContext = new TupleAssignmentContext(this, this._ctx, this.state);
		this.enterRule(localctx, 46, CashScriptParser.RULE_tupleAssignment);
		let _la: number;
		try {
			this.state = 299;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 71:
			case 72:
			case 73:
			case 84:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 277;
				this.tupleTarget();
				this.state = 280;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 278;
					this.match(CashScriptParser.T__17);
					this.state = 279;
					this.tupleTarget();
					}
					}
					this.state = 282;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===18);
				this.state = 284;
				this.match(CashScriptParser.T__9);
				this.state = 285;
				this.expression(0);
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 287;
				this.match(CashScriptParser.T__16);
				this.state = 288;
				this.tupleTarget();
				this.state = 291;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 289;
					this.match(CashScriptParser.T__17);
					this.state = 290;
					this.tupleTarget();
					}
					}
					this.state = 293;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===18);
				this.state = 295;
				this.match(CashScriptParser.T__18);
				this.state = 296;
				this.match(CashScriptParser.T__9);
				this.state = 297;
				this.expression(0);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public tupleTarget(): TupleTargetContext {
		let localctx: TupleTargetContext = new TupleTargetContext(this, this._ctx, this.state);
		this.enterRule(localctx, 48, CashScriptParser.RULE_tupleTarget);
		try {
			this.state = 305;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 71:
			case 72:
			case 73:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 301;
				this.typeName();
				this.state = 302;
				this.match(CashScriptParser.Identifier);
				}
				break;
			case 84:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 304;
				this.match(CashScriptParser.Identifier);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public assignStatement(): AssignStatementContext {
		let localctx: AssignStatementContext = new AssignStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 50, CashScriptParser.RULE_assignStatement);
		let _la: number;
		try {
			this.state = 312;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 307;
				this.match(CashScriptParser.Identifier);
				this.state = 308;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 6292480) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 309;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 310;
				this.match(CashScriptParser.Identifier);
				this.state = 311;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===23 || _la===24)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public timeOpStatement(): TimeOpStatementContext {
		let localctx: TimeOpStatementContext = new TimeOpStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 52, CashScriptParser.RULE_timeOpStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 314;
			this.match(CashScriptParser.T__24);
			this.state = 315;
			this.match(CashScriptParser.T__16);
			this.state = 316;
			this.match(CashScriptParser.TxVar);
			this.state = 317;
			this.match(CashScriptParser.T__5);
			this.state = 318;
			this.expression(0);
			this.state = 321;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===18) {
				{
				this.state = 319;
				this.match(CashScriptParser.T__17);
				this.state = 320;
				this.requireMessage();
				}
			}

			this.state = 323;
			this.match(CashScriptParser.T__18);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public requireStatement(): RequireStatementContext {
		let localctx: RequireStatementContext = new RequireStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 54, CashScriptParser.RULE_requireStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 325;
			this.match(CashScriptParser.T__24);
			this.state = 326;
			this.match(CashScriptParser.T__16);
			this.state = 327;
			this.expression(0);
			this.state = 330;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===18) {
				{
				this.state = 328;
				this.match(CashScriptParser.T__17);
				this.state = 329;
				this.requireMessage();
				}
			}

			this.state = 332;
			this.match(CashScriptParser.T__18);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public consoleStatement(): ConsoleStatementContext {
		let localctx: ConsoleStatementContext = new ConsoleStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 56, CashScriptParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 334;
			this.match(CashScriptParser.T__25);
			this.state = 335;
			this.consoleParameterList();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public ifStatement(): IfStatementContext {
		let localctx: IfStatementContext = new IfStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 58, CashScriptParser.RULE_ifStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 337;
			this.match(CashScriptParser.T__26);
			this.state = 338;
			this.match(CashScriptParser.T__16);
			this.state = 339;
			this.expression(0);
			this.state = 340;
			this.match(CashScriptParser.T__18);
			this.state = 341;
			localctx._ifBlock = this.block();
			this.state = 344;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 30, this._ctx) ) {
			case 1:
				{
				this.state = 342;
				this.match(CashScriptParser.T__27);
				this.state = 343;
				localctx._elseBlock = this.block();
				}
				break;
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public loopStatement(): LoopStatementContext {
		let localctx: LoopStatementContext = new LoopStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 60, CashScriptParser.RULE_loopStatement);
		try {
			this.state = 349;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 29:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 346;
				this.doWhileStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 347;
				this.whileStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 348;
				this.forStatement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public doWhileStatement(): DoWhileStatementContext {
		let localctx: DoWhileStatementContext = new DoWhileStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 62, CashScriptParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 351;
			this.match(CashScriptParser.T__28);
			this.state = 352;
			this.block();
			this.state = 353;
			this.match(CashScriptParser.T__29);
			this.state = 354;
			this.match(CashScriptParser.T__16);
			this.state = 355;
			this.expression(0);
			this.state = 356;
			this.match(CashScriptParser.T__18);
			this.state = 357;
			this.match(CashScriptParser.T__0);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public whileStatement(): WhileStatementContext {
		let localctx: WhileStatementContext = new WhileStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 64, CashScriptParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 359;
			this.match(CashScriptParser.T__29);
			this.state = 360;
			this.match(CashScriptParser.T__16);
			this.state = 361;
			this.expression(0);
			this.state = 362;
			this.match(CashScriptParser.T__18);
			this.state = 363;
			this.block();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public forStatement(): ForStatementContext {
		let localctx: ForStatementContext = new ForStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 66, CashScriptParser.RULE_forStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 365;
			this.match(CashScriptParser.T__30);
			this.state = 366;
			this.match(CashScriptParser.T__16);
			this.state = 367;
			this.forInit();
			this.state = 368;
			this.match(CashScriptParser.T__0);
			this.state = 369;
			this.expression(0);
			this.state = 370;
			this.match(CashScriptParser.T__0);
			this.state = 371;
			this.assignStatement();
			this.state = 372;
			this.match(CashScriptParser.T__18);
			this.state = 373;
			this.block();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public forInit(): ForInitContext {
		let localctx: ForInitContext = new ForInitContext(this, this._ctx, this.state);
		this.enterRule(localctx, 68, CashScriptParser.RULE_forInit);
		try {
			this.state = 377;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 71:
			case 72:
			case 73:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 375;
				this.variableDefinition();
				}
				break;
			case 84:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 376;
				this.assignStatement();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public requireMessage(): RequireMessageContext {
		let localctx: RequireMessageContext = new RequireMessageContext(this, this._ctx, this.state);
		this.enterRule(localctx, 70, CashScriptParser.RULE_requireMessage);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 379;
			this.match(CashScriptParser.StringLiteral);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public consoleParameter(): ConsoleParameterContext {
		let localctx: ConsoleParameterContext = new ConsoleParameterContext(this, this._ctx, this.state);
		this.enterRule(localctx, 72, CashScriptParser.RULE_consoleParameter);
		try {
			this.state = 383;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 84:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 381;
				this.match(CashScriptParser.Identifier);
				}
				break;
			case 66:
			case 68:
			case 75:
			case 76:
			case 77:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 382;
				this.literal();
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public consoleParameterList(): ConsoleParameterListContext {
		let localctx: ConsoleParameterListContext = new ConsoleParameterListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 74, CashScriptParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 385;
			this.match(CashScriptParser.T__16);
			this.state = 397;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 265733) !== 0)) {
				{
				this.state = 386;
				this.consoleParameter();
				this.state = 391;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 387;
						this.match(CashScriptParser.T__17);
						this.state = 388;
						this.consoleParameter();
						}
						}
					}
					this.state = 393;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 34, this._ctx);
				}
				this.state = 395;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===18) {
					{
					this.state = 394;
					this.match(CashScriptParser.T__17);
					}
				}

				}
			}

			this.state = 399;
			this.match(CashScriptParser.T__18);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public functionCall(): FunctionCallContext {
		let localctx: FunctionCallContext = new FunctionCallContext(this, this._ctx, this.state);
		this.enterRule(localctx, 76, CashScriptParser.RULE_functionCall);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 401;
			this.match(CashScriptParser.Identifier);
			this.state = 402;
			this.expressionList();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public expressionList(): ExpressionListContext {
		let localctx: ExpressionListContext = new ExpressionListContext(this, this._ctx, this.state);
		this.enterRule(localctx, 78, CashScriptParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 404;
			this.match(CashScriptParser.T__16);
			this.state = 416;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5 || _la===17 || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 786955) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 290405) !== 0)) {
				{
				this.state = 405;
				this.expression(0);
				this.state = 410;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 37, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 406;
						this.match(CashScriptParser.T__17);
						this.state = 407;
						this.expression(0);
						}
						}
					}
					this.state = 412;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 37, this._ctx);
				}
				this.state = 414;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===18) {
					{
					this.state = 413;
					this.match(CashScriptParser.T__17);
					}
				}

				}
			}

			this.state = 418;
			this.match(CashScriptParser.T__18);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}

	public expression(): ExpressionContext;
	public expression(_p: number): ExpressionContext;
	// @RuleVersion(0)
	public expression(_p?: number): ExpressionContext {
		if (_p === undefined) {
			_p = 0;
		}

		let _parentctx: ParserRuleContext = this._ctx;
		let _parentState: number = this.state;
		let localctx: ExpressionContext = new ExpressionContext(this, this._ctx, _parentState);
		let _prevctx: ExpressionContext = localctx;
		let _startState: number = 80;
		this.enterRecursionRule(localctx, 80, CashScriptParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 469;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 44, this._ctx) ) {
			case 1:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 421;
				this.match(CashScriptParser.T__16);
				this.state = 422;
				this.expression(0);
				this.state = 423;
				this.match(CashScriptParser.T__18);
				}
				break;
			case 2:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 425;
				this.typeCast();
				this.state = 426;
				this.match(CashScriptParser.T__16);
				this.state = 427;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 429;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===18) {
					{
					this.state = 428;
					this.match(CashScriptParser.T__17);
					}
				}

				this.state = 431;
				this.match(CashScriptParser.T__18);
				}
				break;
			case 3:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 433;
				this.functionCall();
				}
				break;
			case 4:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 434;
				this.match(CashScriptParser.T__31);
				this.state = 435;
				this.match(CashScriptParser.Identifier);
				this.state = 436;
				this.expressionList();
				}
				break;
			case 5:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 437;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(CashScriptParser.T__34);
				this.state = 438;
				this.match(CashScriptParser.T__32);
				this.state = 439;
				this.expression(0);
				this.state = 440;
				this.match(CashScriptParser.T__33);
				this.state = 441;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 31) !== 0))) {
				    (localctx as UnaryIntrospectionOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 6:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 443;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(CashScriptParser.T__40);
				this.state = 444;
				this.match(CashScriptParser.T__32);
				this.state = 445;
				this.expression(0);
				this.state = 446;
				this.match(CashScriptParser.T__33);
				this.state = 447;
				(localctx as UnaryIntrospectionOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 991) !== 0))) {
				    (localctx as UnaryIntrospectionOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				}
				break;
			case 7:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 449;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===5 || _la===50 || _la===51)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 450;
				this.expression(15);
				}
				break;
			case 8:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 451;
				this.match(CashScriptParser.T__32);
				this.state = 463;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5 || _la===17 || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 786955) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 290405) !== 0)) {
					{
					this.state = 452;
					this.expression(0);
					this.state = 457;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 41, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 453;
							this.match(CashScriptParser.T__17);
							this.state = 454;
							this.expression(0);
							}
							}
						}
						this.state = 459;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 41, this._ctx);
					}
					this.state = 461;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===18) {
						{
						this.state = 460;
						this.match(CashScriptParser.T__17);
						}
					}

					}
				}

				this.state = 465;
				this.match(CashScriptParser.T__33);
				}
				break;
			case 9:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 466;
				this.match(CashScriptParser.NullaryOp);
				}
				break;
			case 10:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 467;
				this.match(CashScriptParser.Identifier);
				}
				break;
			case 11:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 468;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 523;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 46, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 521;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 45, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 471;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 472;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(((((_la - 52)) & ~0x1F) === 0 && ((1 << (_la - 52)) & 7) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 473;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 474;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 475;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===51 || _la===55)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 476;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 477;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 478;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===56 || _la===57)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 479;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 480;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 481;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 960) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 482;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 483;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 484;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===58 || _la===59)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 485;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 486;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 487;
						(localctx as BinaryOpContext)._op = this.match(CashScriptParser.T__59);
						this.state = 488;
						(localctx as BinaryOpContext)._right = this.expression(10);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 489;
						if (!(this.precpred(this._ctx, 8))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 8)");
						}
						this.state = 490;
						(localctx as BinaryOpContext)._op = this.match(CashScriptParser.T__3);
						this.state = 491;
						(localctx as BinaryOpContext)._right = this.expression(9);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 492;
						if (!(this.precpred(this._ctx, 7))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 7)");
						}
						this.state = 493;
						(localctx as BinaryOpContext)._op = this.match(CashScriptParser.T__60);
						this.state = 494;
						(localctx as BinaryOpContext)._right = this.expression(8);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 495;
						if (!(this.precpred(this._ctx, 6))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 6)");
						}
						this.state = 496;
						(localctx as BinaryOpContext)._op = this.match(CashScriptParser.T__61);
						this.state = 497;
						(localctx as BinaryOpContext)._right = this.expression(7);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 498;
						if (!(this.precpred(this._ctx, 5))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 5)");
						}
						this.state = 499;
						(localctx as BinaryOpContext)._op = this.match(CashScriptParser.T__62);
						this.state = 500;
						(localctx as BinaryOpContext)._right = this.expression(6);
						}
						break;
					case 11:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 501;
						if (!(this.precpred(this._ctx, 21))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 21)");
						}
						this.state = 502;
						this.match(CashScriptParser.T__32);
						this.state = 503;
						(localctx as TupleIndexOpContext)._index = this.match(CashScriptParser.NumberLiteral);
						this.state = 504;
						this.match(CashScriptParser.T__33);
						}
						break;
					case 12:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 505;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 506;
						(localctx as UnaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===46 || _la===47)) {
						    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						}
						break;
					case 13:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 507;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 508;
						(localctx as BinaryOpContext)._op = this.match(CashScriptParser.T__47);
						this.state = 509;
						this.match(CashScriptParser.T__16);
						this.state = 510;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 511;
						this.match(CashScriptParser.T__18);
						}
						break;
					case 14:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, CashScriptParser.RULE_expression);
						this.state = 513;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 514;
						this.match(CashScriptParser.T__48);
						this.state = 515;
						this.match(CashScriptParser.T__16);
						this.state = 516;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 517;
						this.match(CashScriptParser.T__17);
						this.state = 518;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 519;
						this.match(CashScriptParser.T__18);
						}
						break;
					}
					}
				}
				this.state = 525;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 46, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.unrollRecursionContexts(_parentctx);
		}
		return localctx;
	}
	// @RuleVersion(0)
	public modifier(): ModifierContext {
		let localctx: ModifierContext = new ModifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 82, CashScriptParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 526;
			_la = this._input.LA(1);
			if(!(_la===14 || _la===64)) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public literal(): LiteralContext {
		let localctx: LiteralContext = new LiteralContext(this, this._ctx, this.state);
		this.enterRule(localctx, 84, CashScriptParser.RULE_literal);
		try {
			this.state = 533;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 66:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 528;
				this.match(CashScriptParser.BooleanLiteral);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 529;
				this.numberLiteral();
				}
				break;
			case 75:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 530;
				this.match(CashScriptParser.StringLiteral);
				}
				break;
			case 76:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 531;
				this.match(CashScriptParser.DateLiteral);
				}
				break;
			case 77:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 532;
				this.match(CashScriptParser.HexLiteral);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public numberLiteral(): NumberLiteralContext {
		let localctx: NumberLiteralContext = new NumberLiteralContext(this, this._ctx, this.state);
		this.enterRule(localctx, 86, CashScriptParser.RULE_numberLiteral);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 535;
			this.match(CashScriptParser.NumberLiteral);
			this.state = 537;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 48, this._ctx) ) {
			case 1:
				{
				this.state = 536;
				this.match(CashScriptParser.NumberUnit);
				}
				break;
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public typeName(): TypeNameContext {
		let localctx: TypeNameContext = new TypeNameContext(this, this._ctx, this.state);
		this.enterRule(localctx, 88, CashScriptParser.RULE_typeName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 539;
			_la = this._input.LA(1);
			if(!(((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 7) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}
	// @RuleVersion(0)
	public typeCast(): TypeCastContext {
		let localctx: TypeCastContext = new TypeCastContext(this, this._ctx, this.state);
		this.enterRule(localctx, 90, CashScriptParser.RULE_typeCast);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 541;
			_la = this._input.LA(1);
			if(!(((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 259) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return localctx;
	}

	public sempred(localctx: RuleContext, ruleIndex: number, predIndex: number): boolean {
		switch (ruleIndex) {
		case 40:
			return this.expression_sempred(localctx as ExpressionContext, predIndex);
		}
		return true;
	}
	private expression_sempred(localctx: ExpressionContext, predIndex: number): boolean {
		switch (predIndex) {
		case 0:
			return this.precpred(this._ctx, 14);
		case 1:
			return this.precpred(this._ctx, 13);
		case 2:
			return this.precpred(this._ctx, 12);
		case 3:
			return this.precpred(this._ctx, 11);
		case 4:
			return this.precpred(this._ctx, 10);
		case 5:
			return this.precpred(this._ctx, 9);
		case 6:
			return this.precpred(this._ctx, 8);
		case 7:
			return this.precpred(this._ctx, 7);
		case 8:
			return this.precpred(this._ctx, 6);
		case 9:
			return this.precpred(this._ctx, 5);
		case 10:
			return this.precpred(this._ctx, 21);
		case 11:
			return this.precpred(this._ctx, 18);
		case 12:
			return this.precpred(this._ctx, 17);
		case 13:
			return this.precpred(this._ctx, 16);
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,87,544,2,0,7,0,2,
	1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,
	10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,
	7,17,2,18,7,18,2,19,7,19,2,20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,
	24,2,25,7,25,2,26,7,26,2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,
	2,32,7,32,2,33,7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,
	39,7,39,2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,1,0,
	5,0,94,8,0,10,0,12,0,97,9,0,1,0,5,0,100,8,0,10,0,12,0,103,9,0,1,0,1,0,1,
	1,1,1,1,1,1,1,3,1,111,8,1,1,2,1,2,1,2,1,2,1,3,1,3,1,3,1,3,1,3,1,4,1,4,1,
	5,1,5,3,5,126,8,5,1,6,3,6,129,8,6,1,6,1,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,5,
	8,140,8,8,10,8,12,8,143,9,8,1,8,1,8,1,9,1,9,1,9,1,9,5,9,151,8,9,10,9,12,
	9,154,9,9,1,9,1,9,1,10,1,10,3,10,160,8,10,1,11,1,11,1,11,1,11,1,11,1,11,
	1,11,1,12,3,12,170,8,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,5,12,180,
	8,12,10,12,12,12,183,9,12,1,12,1,12,3,12,187,8,12,1,12,1,12,1,13,1,13,5,
	13,193,8,13,10,13,12,13,196,9,13,1,13,1,13,1,14,1,14,1,14,1,14,5,14,204,
	8,14,10,14,12,14,207,9,14,1,14,3,14,210,8,14,3,14,212,8,14,1,14,1,14,1,
	15,1,15,5,15,218,8,15,10,15,12,15,221,9,15,1,15,1,15,1,16,1,16,5,16,227,
	8,16,10,16,12,16,230,9,16,1,16,1,16,3,16,234,8,16,1,17,1,17,1,17,1,17,3,
	17,240,8,17,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,3,18,250,8,18,1,19,
	1,19,1,20,1,20,1,20,1,20,5,20,258,8,20,10,20,12,20,261,9,20,1,21,1,21,3,
	21,265,8,21,1,22,1,22,5,22,269,8,22,10,22,12,22,272,9,22,1,22,1,22,1,22,
	1,22,1,23,1,23,1,23,4,23,281,8,23,11,23,12,23,282,1,23,1,23,1,23,1,23,1,
	23,1,23,1,23,4,23,292,8,23,11,23,12,23,293,1,23,1,23,1,23,1,23,3,23,300,
	8,23,1,24,1,24,1,24,1,24,3,24,306,8,24,1,25,1,25,1,25,1,25,1,25,3,25,313,
	8,25,1,26,1,26,1,26,1,26,1,26,1,26,1,26,3,26,322,8,26,1,26,1,26,1,27,1,
	27,1,27,1,27,1,27,3,27,331,8,27,1,27,1,27,1,28,1,28,1,28,1,29,1,29,1,29,
	1,29,1,29,1,29,1,29,3,29,345,8,29,1,30,1,30,1,30,3,30,350,8,30,1,31,1,31,
	1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,1,32,1,32,1,32,1,33,1,33,1,
	33,1,33,1,33,1,33,1,33,1,33,1,33,1,33,1,34,1,34,3,34,378,8,34,1,35,1,35,
	1,36,1,36,3,36,384,8,36,1,37,1,37,1,37,1,37,5,37,390,8,37,10,37,12,37,393,
	9,37,1,37,3,37,396,8,37,3,37,398,8,37,1,37,1,37,1,38,1,38,1,38,1,39,1,39,
	1,39,1,39,5,39,409,8,39,10,39,12,39,412,9,39,1,39,3,39,415,8,39,3,39,417,
	8,39,1,39,1,39,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,3,40,430,8,
	40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,
	1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,5,40,456,8,40,10,40,12,
	40,459,9,40,1,40,3,40,462,8,40,3,40,464,8,40,1,40,1,40,1,40,1,40,3,40,470,
	8,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,
	40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,
	1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,
	40,1,40,1,40,1,40,1,40,1,40,1,40,1,40,5,40,522,8,40,10,40,12,40,525,9,40,
	1,41,1,41,1,42,1,42,1,42,1,42,1,42,3,42,534,8,42,1,43,1,43,3,43,538,8,43,
	1,44,1,44,1,45,1,45,1,45,0,1,80,46,0,2,4,6,8,10,12,14,16,18,20,22,24,26,
	28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,
	76,78,80,82,84,86,88,90,0,15,1,0,4,10,2,0,10,10,21,22,1,0,23,24,1,0,36,
	40,2,0,36,40,42,45,2,0,5,5,50,51,1,0,52,54,2,0,51,51,55,55,1,0,56,57,1,
	0,6,9,1,0,58,59,1,0,46,47,2,0,14,14,64,64,1,0,71,73,2,0,71,72,79,79,579,
	0,95,1,0,0,0,2,110,1,0,0,0,4,112,1,0,0,0,6,116,1,0,0,0,8,121,1,0,0,0,10,
	123,1,0,0,0,12,128,1,0,0,0,14,132,1,0,0,0,16,134,1,0,0,0,18,146,1,0,0,0,
	20,159,1,0,0,0,22,161,1,0,0,0,24,169,1,0,0,0,26,190,1,0,0,0,28,199,1,0,
	0,0,30,215,1,0,0,0,32,233,1,0,0,0,34,239,1,0,0,0,36,249,1,0,0,0,38,251,
	1,0,0,0,40,253,1,0,0,0,42,264,1,0,0,0,44,266,1,0,0,0,46,299,1,0,0,0,48,
	305,1,0,0,0,50,312,1,0,0,0,52,314,1,0,0,0,54,325,1,0,0,0,56,334,1,0,0,0,
	58,337,1,0,0,0,60,349,1,0,0,0,62,351,1,0,0,0,64,359,1,0,0,0,66,365,1,0,
	0,0,68,377,1,0,0,0,70,379,1,0,0,0,72,383,1,0,0,0,74,385,1,0,0,0,76,401,
	1,0,0,0,78,404,1,0,0,0,80,469,1,0,0,0,82,526,1,0,0,0,84,533,1,0,0,0,86,
	535,1,0,0,0,88,539,1,0,0,0,90,541,1,0,0,0,92,94,3,6,3,0,93,92,1,0,0,0,94,
	97,1,0,0,0,95,93,1,0,0,0,95,96,1,0,0,0,96,101,1,0,0,0,97,95,1,0,0,0,98,
	100,3,2,1,0,99,98,1,0,0,0,100,103,1,0,0,0,101,99,1,0,0,0,101,102,1,0,0,
	0,102,104,1,0,0,0,103,101,1,0,0,0,104,105,5,0,0,1,105,1,1,0,0,0,106,111,
	3,4,2,0,107,111,3,22,11,0,108,111,3,18,9,0,109,111,3,16,8,0,110,106,1,0,
	0,0,110,107,1,0,0,0,110,108,1,0,0,0,110,109,1,0,0,0,111,3,1,0,0,0,112,113,
	5,83,0,0,113,114,5,75,0,0,114,115,5,1,0,0,115,5,1,0,0,0,116,117,5,2,0,0,
	117,118,3,8,4,0,118,119,3,10,5,0,119,120,5,1,0,0,120,7,1,0,0,0,121,122,
	5,3,0,0,122,9,1,0,0,0,123,125,3,12,6,0,124,126,3,12,6,0,125,124,1,0,0,0,
	125,126,1,0,0,0,126,11,1,0,0,0,127,129,3,14,7,0,128,127,1,0,0,0,128,129,
	1,0,0,0,129,130,1,0,0,0,130,131,5,65,0,0,131,13,1,0,0,0,132,133,7,0,0,0,
	133,15,1,0,0,0,134,135,5,11,0,0,135,136,5,84,0,0,136,137,3,28,14,0,137,
	141,5,12,0,0,138,140,3,24,12,0,139,138,1,0,0,0,140,143,1,0,0,0,141,139,
	1,0,0,0,141,142,1,0,0,0,142,144,1,0,0,0,143,141,1,0,0,0,144,145,5,13,0,
	0,145,17,1,0,0,0,146,147,5,82,0,0,147,148,5,84,0,0,148,152,5,12,0,0,149,
	151,3,20,10,0,150,149,1,0,0,0,151,154,1,0,0,0,152,150,1,0,0,0,152,153,1,
	0,0,0,153,155,1,0,0,0,154,152,1,0,0,0,155,156,5,13,0,0,156,19,1,0,0,0,157,
	160,3,22,11,0,158,160,3,24,12,0,159,157,1,0,0,0,159,158,1,0,0,0,160,21,
	1,0,0,0,161,162,3,88,44,0,162,163,5,14,0,0,163,164,5,84,0,0,164,165,5,10,
	0,0,165,166,3,80,40,0,166,167,5,1,0,0,167,23,1,0,0,0,168,170,5,81,0,0,169,
	168,1,0,0,0,169,170,1,0,0,0,170,171,1,0,0,0,171,172,5,15,0,0,172,173,5,
	84,0,0,173,186,3,28,14,0,174,175,5,16,0,0,175,176,5,17,0,0,176,181,3,88,
	44,0,177,178,5,18,0,0,178,180,3,88,44,0,179,177,1,0,0,0,180,183,1,0,0,0,
	181,179,1,0,0,0,181,182,1,0,0,0,182,184,1,0,0,0,183,181,1,0,0,0,184,185,
	5,19,0,0,185,187,1,0,0,0,186,174,1,0,0,0,186,187,1,0,0,0,187,188,1,0,0,
	0,188,189,3,26,13,0,189,25,1,0,0,0,190,194,5,12,0,0,191,193,3,34,17,0,192,
	191,1,0,0,0,193,196,1,0,0,0,194,192,1,0,0,0,194,195,1,0,0,0,195,197,1,0,
	0,0,196,194,1,0,0,0,197,198,5,13,0,0,198,27,1,0,0,0,199,211,5,17,0,0,200,
	205,3,30,15,0,201,202,5,18,0,0,202,204,3,30,15,0,203,201,1,0,0,0,204,207,
	1,0,0,0,205,203,1,0,0,0,205,206,1,0,0,0,206,209,1,0,0,0,207,205,1,0,0,0,
	208,210,5,18,0,0,209,208,1,0,0,0,209,210,1,0,0,0,210,212,1,0,0,0,211,200,
	1,0,0,0,211,212,1,0,0,0,212,213,1,0,0,0,213,214,5,19,0,0,214,29,1,0,0,0,
	215,219,3,88,44,0,216,218,3,82,41,0,217,216,1,0,0,0,218,221,1,0,0,0,219,
	217,1,0,0,0,219,220,1,0,0,0,220,222,1,0,0,0,221,219,1,0,0,0,222,223,5,84,
	0,0,223,31,1,0,0,0,224,228,5,12,0,0,225,227,3,34,17,0,226,225,1,0,0,0,227,
	230,1,0,0,0,228,226,1,0,0,0,228,229,1,0,0,0,229,231,1,0,0,0,230,228,1,0,
	0,0,231,234,5,13,0,0,232,234,3,34,17,0,233,224,1,0,0,0,233,232,1,0,0,0,
	234,33,1,0,0,0,235,240,3,42,21,0,236,237,3,36,18,0,237,238,5,1,0,0,238,
	240,1,0,0,0,239,235,1,0,0,0,239,236,1,0,0,0,240,35,1,0,0,0,241,250,3,44,
	22,0,242,250,3,46,23,0,243,250,3,50,25,0,244,250,3,52,26,0,245,250,3,54,
	27,0,246,250,3,38,19,0,247,250,3,56,28,0,248,250,3,40,20,0,249,241,1,0,
	0,0,249,242,1,0,0,0,249,243,1,0,0,0,249,244,1,0,0,0,249,245,1,0,0,0,249,
	246,1,0,0,0,249,247,1,0,0,0,249,248,1,0,0,0,250,37,1,0,0,0,251,252,3,76,
	38,0,252,39,1,0,0,0,253,254,5,20,0,0,254,259,3,80,40,0,255,256,5,18,0,0,
	256,258,3,80,40,0,257,255,1,0,0,0,258,261,1,0,0,0,259,257,1,0,0,0,259,260,
	1,0,0,0,260,41,1,0,0,0,261,259,1,0,0,0,262,265,3,58,29,0,263,265,3,60,30,
	0,264,262,1,0,0,0,264,263,1,0,0,0,265,43,1,0,0,0,266,270,3,88,44,0,267,
	269,3,82,41,0,268,267,1,0,0,0,269,272,1,0,0,0,270,268,1,0,0,0,270,271,1,
	0,0,0,271,273,1,0,0,0,272,270,1,0,0,0,273,274,5,84,0,0,274,275,5,10,0,0,
	275,276,3,80,40,0,276,45,1,0,0,0,277,280,3,48,24,0,278,279,5,18,0,0,279,
	281,3,48,24,0,280,278,1,0,0,0,281,282,1,0,0,0,282,280,1,0,0,0,282,283,1,
	0,0,0,283,284,1,0,0,0,284,285,5,10,0,0,285,286,3,80,40,0,286,300,1,0,0,
	0,287,288,5,17,0,0,288,291,3,48,24,0,289,290,5,18,0,0,290,292,3,48,24,0,
	291,289,1,0,0,0,292,293,1,0,0,0,293,291,1,0,0,0,293,294,1,0,0,0,294,295,
	1,0,0,0,295,296,5,19,0,0,296,297,5,10,0,0,297,298,3,80,40,0,298,300,1,0,
	0,0,299,277,1,0,0,0,299,287,1,0,0,0,300,47,1,0,0,0,301,302,3,88,44,0,302,
	303,5,84,0,0,303,306,1,0,0,0,304,306,5,84,0,0,305,301,1,0,0,0,305,304,1,
	0,0,0,306,49,1,0,0,0,307,308,5,84,0,0,308,309,7,1,0,0,309,313,3,80,40,0,
	310,311,5,84,0,0,311,313,7,2,0,0,312,307,1,0,0,0,312,310,1,0,0,0,313,51,
	1,0,0,0,314,315,5,25,0,0,315,316,5,17,0,0,316,317,5,78,0,0,317,318,5,6,
	0,0,318,321,3,80,40,0,319,320,5,18,0,0,320,322,3,70,35,0,321,319,1,0,0,
	0,321,322,1,0,0,0,322,323,1,0,0,0,323,324,5,19,0,0,324,53,1,0,0,0,325,326,
	5,25,0,0,326,327,5,17,0,0,327,330,3,80,40,0,328,329,5,18,0,0,329,331,3,
	70,35,0,330,328,1,0,0,0,330,331,1,0,0,0,331,332,1,0,0,0,332,333,5,19,0,
	0,333,55,1,0,0,0,334,335,5,26,0,0,335,336,3,74,37,0,336,57,1,0,0,0,337,
	338,5,27,0,0,338,339,5,17,0,0,339,340,3,80,40,0,340,341,5,19,0,0,341,344,
	3,32,16,0,342,343,5,28,0,0,343,345,3,32,16,0,344,342,1,0,0,0,344,345,1,
	0,0,0,345,59,1,0,0,0,346,350,3,62,31,0,347,350,3,64,32,0,348,350,3,66,33,
	0,349,346,1,0,0,0,349,347,1,0,0,0,349,348,1,0,0,0,350,61,1,0,0,0,351,352,
	5,29,0,0,352,353,3,32,16,0,353,354,5,30,0,0,354,355,5,17,0,0,355,356,3,
	80,40,0,356,357,5,19,0,0,357,358,5,1,0,0,358,63,1,0,0,0,359,360,5,30,0,
	0,360,361,5,17,0,0,361,362,3,80,40,0,362,363,5,19,0,0,363,364,3,32,16,0,
	364,65,1,0,0,0,365,366,5,31,0,0,366,367,5,17,0,0,367,368,3,68,34,0,368,
	369,5,1,0,0,369,370,3,80,40,0,370,371,5,1,0,0,371,372,3,50,25,0,372,373,
	5,19,0,0,373,374,3,32,16,0,374,67,1,0,0,0,375,378,3,44,22,0,376,378,3,50,
	25,0,377,375,1,0,0,0,377,376,1,0,0,0,378,69,1,0,0,0,379,380,5,75,0,0,380,
	71,1,0,0,0,381,384,5,84,0,0,382,384,3,84,42,0,383,381,1,0,0,0,383,382,1,
	0,0,0,384,73,1,0,0,0,385,397,5,17,0,0,386,391,3,72,36,0,387,388,5,18,0,
	0,388,390,3,72,36,0,389,387,1,0,0,0,390,393,1,0,0,0,391,389,1,0,0,0,391,
	392,1,0,0,0,392,395,1,0,0,0,393,391,1,0,0,0,394,396,5,18,0,0,395,394,1,
	0,0,0,395,396,1,0,0,0,396,398,1,0,0,0,397,386,1,0,0,0,397,398,1,0,0,0,398,
	399,1,0,0,0,399,400,5,19,0,0,400,75,1,0,0,0,401,402,5,84,0,0,402,403,3,
	78,39,0,403,77,1,0,0,0,404,416,5,17,0,0,405,410,3,80,40,0,406,407,5,18,
	0,0,407,409,3,80,40,0,408,406,1,0,0,0,409,412,1,0,0,0,410,408,1,0,0,0,410,
	411,1,0,0,0,411,414,1,0,0,0,412,410,1,0,0,0,413,415,5,18,0,0,414,413,1,
	0,0,0,414,415,1,0,0,0,415,417,1,0,0,0,416,405,1,0,0,0,416,417,1,0,0,0,417,
	418,1,0,0,0,418,419,5,19,0,0,419,79,1,0,0,0,420,421,6,40,-1,0,421,422,5,
	17,0,0,422,423,3,80,40,0,423,424,5,19,0,0,424,470,1,0,0,0,425,426,3,90,
	45,0,426,427,5,17,0,0,427,429,3,80,40,0,428,430,5,18,0,0,429,428,1,0,0,
	0,429,430,1,0,0,0,430,431,1,0,0,0,431,432,5,19,0,0,432,470,1,0,0,0,433,
	470,3,76,38,0,434,435,5,32,0,0,435,436,5,84,0,0,436,470,3,78,39,0,437,438,
	5,35,0,0,438,439,5,33,0,0,439,440,3,80,40,0,440,441,5,34,0,0,441,442,7,
	3,0,0,442,470,1,0,0,0,443,444,5,41,0,0,444,445,5,33,0,0,445,446,3,80,40,
	0,446,447,5,34,0,0,447,448,7,4,0,0,448,470,1,0,0,0,449,450,7,5,0,0,450,
	470,3,80,40,15,451,463,5,33,0,0,452,457,3,80,40,0,453,454,5,18,0,0,454,
	456,3,80,40,0,455,453,1,0,0,0,456,459,1,0,0,0,457,455,1,0,0,0,457,458,1,
	0,0,0,458,461,1,0,0,0,459,457,1,0,0,0,460,462,5,18,0,0,461,460,1,0,0,0,
	461,462,1,0,0,0,462,464,1,0,0,0,463,452,1,0,0,0,463,464,1,0,0,0,464,465,
	1,0,0,0,465,470,5,34,0,0,466,470,5,80,0,0,467,470,5,84,0,0,468,470,3,84,
	42,0,469,420,1,0,0,0,469,425,1,0,0,0,469,433,1,0,0,0,469,434,1,0,0,0,469,
	437,1,0,0,0,469,443,1,0,0,0,469,449,1,0,0,0,469,451,1,0,0,0,469,466,1,0,
	0,0,469,467,1,0,0,0,469,468,1,0,0,0,470,523,1,0,0,0,471,472,10,14,0,0,472,
	473,7,6,0,0,473,522,3,80,40,15,474,475,10,13,0,0,475,476,7,7,0,0,476,522,
	3,80,40,14,477,478,10,12,0,0,478,479,7,8,0,0,479,522,3,80,40,13,480,481,
	10,11,0,0,481,482,7,9,0,0,482,522,3,80,40,12,483,484,10,10,0,0,484,485,
	7,10,0,0,485,522,3,80,40,11,486,487,10,9,0,0,487,488,5,60,0,0,488,522,3,
	80,40,10,489,490,10,8,0,0,490,491,5,4,0,0,491,522,3,80,40,9,492,493,10,
	7,0,0,493,494,5,61,0,0,494,522,3,80,40,8,495,496,10,6,0,0,496,497,5,62,
	0,0,497,522,3,80,40,7,498,499,10,5,0,0,499,500,5,63,0,0,500,522,3,80,40,
	6,501,502,10,21,0,0,502,503,5,33,0,0,503,504,5,68,0,0,504,522,5,34,0,0,
	505,506,10,18,0,0,506,522,7,11,0,0,507,508,10,17,0,0,508,509,5,48,0,0,509,
	510,5,17,0,0,510,511,3,80,40,0,511,512,5,19,0,0,512,522,1,0,0,0,513,514,
	10,16,0,0,514,515,5,49,0,0,515,516,5,17,0,0,516,517,3,80,40,0,517,518,5,
	18,0,0,518,519,3,80,40,0,519,520,5,19,0,0,520,522,1,0,0,0,521,471,1,0,0,
	0,521,474,1,0,0,0,521,477,1,0,0,0,521,480,1,0,0,0,521,483,1,0,0,0,521,486,
	1,0,0,0,521,489,1,0,0,0,521,492,1,0,0,0,521,495,1,0,0,0,521,498,1,0,0,0,
	521,501,1,0,0,0,521,505,1,0,0,0,521,507,1,0,0,0,521,513,1,0,0,0,522,525,
	1,0,0,0,523,521,1,0,0,0,523,524,1,0,0,0,524,81,1,0,0,0,525,523,1,0,0,0,
	526,527,7,12,0,0,527,83,1,0,0,0,528,534,5,66,0,0,529,534,3,86,43,0,530,
	534,5,75,0,0,531,534,5,76,0,0,532,534,5,77,0,0,533,528,1,0,0,0,533,529,
	1,0,0,0,533,530,1,0,0,0,533,531,1,0,0,0,533,532,1,0,0,0,534,85,1,0,0,0,
	535,537,5,68,0,0,536,538,5,67,0,0,537,536,1,0,0,0,537,538,1,0,0,0,538,87,
	1,0,0,0,539,540,7,13,0,0,540,89,1,0,0,0,541,542,7,14,0,0,542,91,1,0,0,0,
	49,95,101,110,125,128,141,152,159,169,181,186,194,205,209,211,219,228,233,
	239,249,259,264,270,282,293,299,305,312,321,330,344,349,377,383,391,395,
	397,410,414,416,429,457,461,463,469,521,523,533,537];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!CashScriptParser.__ATN) {
			CashScriptParser.__ATN = new ATNDeserializer().deserialize(CashScriptParser._serializedATN);
		}

		return CashScriptParser.__ATN;
	}


	static DecisionsToDFA = CashScriptParser._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );

}

export class SourceFileContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public EOF(): TerminalNode {
		return this.getToken(CashScriptParser.EOF, 0);
	}
	public pragmaDirective_list(): PragmaDirectiveContext[] {
		return this.getTypedRuleContexts(PragmaDirectiveContext) as PragmaDirectiveContext[];
	}
	public pragmaDirective(i: number): PragmaDirectiveContext {
		return this.getTypedRuleContext(PragmaDirectiveContext, i) as PragmaDirectiveContext;
	}
	public topLevelDefinition_list(): TopLevelDefinitionContext[] {
		return this.getTypedRuleContexts(TopLevelDefinitionContext) as TopLevelDefinitionContext[];
	}
	public topLevelDefinition(i: number): TopLevelDefinitionContext {
		return this.getTypedRuleContext(TopLevelDefinitionContext, i) as TopLevelDefinitionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_sourceFile;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitSourceFile) {
			return visitor.visitSourceFile(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TopLevelDefinitionContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public importDirective(): ImportDirectiveContext {
		return this.getTypedRuleContext(ImportDirectiveContext, 0) as ImportDirectiveContext;
	}
	public constantDefinition(): ConstantDefinitionContext {
		return this.getTypedRuleContext(ConstantDefinitionContext, 0) as ConstantDefinitionContext;
	}
	public libraryDefinition(): LibraryDefinitionContext {
		return this.getTypedRuleContext(LibraryDefinitionContext, 0) as LibraryDefinitionContext;
	}
	public contractDefinition(): ContractDefinitionContext {
		return this.getTypedRuleContext(ContractDefinitionContext, 0) as ContractDefinitionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_topLevelDefinition;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitTopLevelDefinition) {
			return visitor.visitTopLevelDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ImportDirectiveContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Import(): TerminalNode {
		return this.getToken(CashScriptParser.Import, 0);
	}
	public StringLiteral(): TerminalNode {
		return this.getToken(CashScriptParser.StringLiteral, 0);
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_importDirective;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitImportDirective) {
			return visitor.visitImportDirective(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PragmaDirectiveContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public pragmaName(): PragmaNameContext {
		return this.getTypedRuleContext(PragmaNameContext, 0) as PragmaNameContext;
	}
	public pragmaValue(): PragmaValueContext {
		return this.getTypedRuleContext(PragmaValueContext, 0) as PragmaValueContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_pragmaDirective;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitPragmaDirective) {
			return visitor.visitPragmaDirective(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PragmaNameContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_pragmaName;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitPragmaName) {
			return visitor.visitPragmaName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class PragmaValueContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public versionConstraint_list(): VersionConstraintContext[] {
		return this.getTypedRuleContexts(VersionConstraintContext) as VersionConstraintContext[];
	}
	public versionConstraint(i: number): VersionConstraintContext {
		return this.getTypedRuleContext(VersionConstraintContext, i) as VersionConstraintContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_pragmaValue;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitPragmaValue) {
			return visitor.visitPragmaValue(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VersionConstraintContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public VersionLiteral(): TerminalNode {
		return this.getToken(CashScriptParser.VersionLiteral, 0);
	}
	public versionOperator(): VersionOperatorContext {
		return this.getTypedRuleContext(VersionOperatorContext, 0) as VersionOperatorContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_versionConstraint;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitVersionConstraint) {
			return visitor.visitVersionConstraint(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VersionOperatorContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_versionOperator;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitVersionOperator) {
			return visitor.visitVersionOperator(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ContractDefinitionContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public functionDefinition_list(): FunctionDefinitionContext[] {
		return this.getTypedRuleContexts(FunctionDefinitionContext) as FunctionDefinitionContext[];
	}
	public functionDefinition(i: number): FunctionDefinitionContext {
		return this.getTypedRuleContext(FunctionDefinitionContext, i) as FunctionDefinitionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_contractDefinition;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitContractDefinition) {
			return visitor.visitContractDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LibraryDefinitionContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Library(): TerminalNode {
		return this.getToken(CashScriptParser.Library, 0);
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public libraryMember_list(): LibraryMemberContext[] {
		return this.getTypedRuleContexts(LibraryMemberContext) as LibraryMemberContext[];
	}
	public libraryMember(i: number): LibraryMemberContext {
		return this.getTypedRuleContext(LibraryMemberContext, i) as LibraryMemberContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_libraryDefinition;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitLibraryDefinition) {
			return visitor.visitLibraryDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LibraryMemberContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public constantDefinition(): ConstantDefinitionContext {
		return this.getTypedRuleContext(ConstantDefinitionContext, 0) as ConstantDefinitionContext;
	}
	public functionDefinition(): FunctionDefinitionContext {
		return this.getTypedRuleContext(FunctionDefinitionContext, 0) as FunctionDefinitionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_libraryMember;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitLibraryMember) {
			return visitor.visitLibraryMember(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConstantDefinitionContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_constantDefinition;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitConstantDefinition) {
			return visitor.visitConstantDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionDefinitionContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public parameterList(): ParameterListContext {
		return this.getTypedRuleContext(ParameterListContext, 0) as ParameterListContext;
	}
	public functionBody(): FunctionBodyContext {
		return this.getTypedRuleContext(FunctionBodyContext, 0) as FunctionBodyContext;
	}
	public Internal(): TerminalNode {
		return this.getToken(CashScriptParser.Internal, 0);
	}
	public typeName_list(): TypeNameContext[] {
		return this.getTypedRuleContexts(TypeNameContext) as TypeNameContext[];
	}
	public typeName(i: number): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, i) as TypeNameContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_functionDefinition;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitFunctionDefinition) {
			return visitor.visitFunctionDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionBodyContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_functionBody;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitFunctionBody) {
			return visitor.visitFunctionBody(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParameterListContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public parameter_list(): ParameterContext[] {
		return this.getTypedRuleContexts(ParameterContext) as ParameterContext[];
	}
	public parameter(i: number): ParameterContext {
		return this.getTypedRuleContext(ParameterContext, i) as ParameterContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_parameterList;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitParameterList) {
			return visitor.visitParameterList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParameterContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_parameter;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitParameter) {
			return visitor.visitParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class BlockContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public statement_list(): StatementContext[] {
		return this.getTypedRuleContexts(StatementContext) as StatementContext[];
	}
	public statement(i: number): StatementContext {
		return this.getTypedRuleContext(StatementContext, i) as StatementContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_block;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitBlock) {
			return visitor.visitBlock(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public controlStatement(): ControlStatementContext {
		return this.getTypedRuleContext(ControlStatementContext, 0) as ControlStatementContext;
	}
	public nonControlStatement(): NonControlStatementContext {
		return this.getTypedRuleContext(NonControlStatementContext, 0) as NonControlStatementContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_statement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitStatement) {
			return visitor.visitStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NonControlStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public variableDefinition(): VariableDefinitionContext {
		return this.getTypedRuleContext(VariableDefinitionContext, 0) as VariableDefinitionContext;
	}
	public tupleAssignment(): TupleAssignmentContext {
		return this.getTypedRuleContext(TupleAssignmentContext, 0) as TupleAssignmentContext;
	}
	public assignStatement(): AssignStatementContext {
		return this.getTypedRuleContext(AssignStatementContext, 0) as AssignStatementContext;
	}
	public timeOpStatement(): TimeOpStatementContext {
		return this.getTypedRuleContext(TimeOpStatementContext, 0) as TimeOpStatementContext;
	}
	public requireStatement(): RequireStatementContext {
		return this.getTypedRuleContext(RequireStatementContext, 0) as RequireStatementContext;
	}
	public functionCallStatement(): FunctionCallStatementContext {
		return this.getTypedRuleContext(FunctionCallStatementContext, 0) as FunctionCallStatementContext;
	}
	public consoleStatement(): ConsoleStatementContext {
		return this.getTypedRuleContext(ConsoleStatementContext, 0) as ConsoleStatementContext;
	}
	public returnStatement(): ReturnStatementContext {
		return this.getTypedRuleContext(ReturnStatementContext, 0) as ReturnStatementContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_nonControlStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitNonControlStatement) {
			return visitor.visitNonControlStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionCallStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public functionCall(): FunctionCallContext {
		return this.getTypedRuleContext(FunctionCallContext, 0) as FunctionCallContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_functionCallStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitFunctionCallStatement) {
			return visitor.visitFunctionCallStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ReturnStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_returnStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitReturnStatement) {
			return visitor.visitReturnStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ControlStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public ifStatement(): IfStatementContext {
		return this.getTypedRuleContext(IfStatementContext, 0) as IfStatementContext;
	}
	public loopStatement(): LoopStatementContext {
		return this.getTypedRuleContext(LoopStatementContext, 0) as LoopStatementContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_controlStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitControlStatement) {
			return visitor.visitControlStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class VariableDefinitionContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public modifier_list(): ModifierContext[] {
		return this.getTypedRuleContexts(ModifierContext) as ModifierContext[];
	}
	public modifier(i: number): ModifierContext {
		return this.getTypedRuleContext(ModifierContext, i) as ModifierContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_variableDefinition;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitVariableDefinition) {
			return visitor.visitVariableDefinition(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TupleAssignmentContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public tupleTarget_list(): TupleTargetContext[] {
		return this.getTypedRuleContexts(TupleTargetContext) as TupleTargetContext[];
	}
	public tupleTarget(i: number): TupleTargetContext {
		return this.getTypedRuleContext(TupleTargetContext, i) as TupleTargetContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_tupleAssignment;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitTupleAssignment) {
			return visitor.visitTupleAssignment(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TupleTargetContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public typeName(): TypeNameContext {
		return this.getTypedRuleContext(TypeNameContext, 0) as TypeNameContext;
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_tupleTarget;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitTupleTarget) {
			return visitor.visitTupleTarget(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class AssignStatementContext extends ParserRuleContext {
	public _op!: Token;
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_assignStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitAssignStatement) {
			return visitor.visitAssignStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TimeOpStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public TxVar(): TerminalNode {
		return this.getToken(CashScriptParser.TxVar, 0);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public requireMessage(): RequireMessageContext {
		return this.getTypedRuleContext(RequireMessageContext, 0) as RequireMessageContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_timeOpStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitTimeOpStatement) {
			return visitor.visitTimeOpStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class RequireStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public requireMessage(): RequireMessageContext {
		return this.getTypedRuleContext(RequireMessageContext, 0) as RequireMessageContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_requireStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitRequireStatement) {
			return visitor.visitRequireStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConsoleStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public consoleParameterList(): ConsoleParameterListContext {
		return this.getTypedRuleContext(ConsoleParameterListContext, 0) as ConsoleParameterListContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_consoleStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitConsoleStatement) {
			return visitor.visitConsoleStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IfStatementContext extends ParserRuleContext {
	public _ifBlock!: BlockContext;
	public _elseBlock!: BlockContext;
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public block_list(): BlockContext[] {
		return this.getTypedRuleContexts(BlockContext) as BlockContext[];
	}
	public block(i: number): BlockContext {
		return this.getTypedRuleContext(BlockContext, i) as BlockContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_ifStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitIfStatement) {
			return visitor.visitIfStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LoopStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public doWhileStatement(): DoWhileStatementContext {
		return this.getTypedRuleContext(DoWhileStatementContext, 0) as DoWhileStatementContext;
	}
	public whileStatement(): WhileStatementContext {
		return this.getTypedRuleContext(WhileStatementContext, 0) as WhileStatementContext;
	}
	public forStatement(): ForStatementContext {
		return this.getTypedRuleContext(ForStatementContext, 0) as ForStatementContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_loopStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitLoopStatement) {
			return visitor.visitLoopStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DoWhileStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_doWhileStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitDoWhileStatement) {
			return visitor.visitDoWhileStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class WhileStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_whileStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitWhileStatement) {
			return visitor.visitWhileStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForStatementContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public forInit(): ForInitContext {
		return this.getTypedRuleContext(ForInitContext, 0) as ForInitContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public assignStatement(): AssignStatementContext {
		return this.getTypedRuleContext(AssignStatementContext, 0) as AssignStatementContext;
	}
	public block(): BlockContext {
		return this.getTypedRuleContext(BlockContext, 0) as BlockContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_forStatement;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitForStatement) {
			return visitor.visitForStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ForInitContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public variableDefinition(): VariableDefinitionContext {
		return this.getTypedRuleContext(VariableDefinitionContext, 0) as VariableDefinitionContext;
	}
	public assignStatement(): AssignStatementContext {
		return this.getTypedRuleContext(AssignStatementContext, 0) as AssignStatementContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_forInit;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitForInit) {
			return visitor.visitForInit(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class RequireMessageContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public StringLiteral(): TerminalNode {
		return this.getToken(CashScriptParser.StringLiteral, 0);
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_requireMessage;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitRequireMessage) {
			return visitor.visitRequireMessage(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConsoleParameterContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public literal(): LiteralContext {
		return this.getTypedRuleContext(LiteralContext, 0) as LiteralContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_consoleParameter;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitConsoleParameter) {
			return visitor.visitConsoleParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ConsoleParameterListContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public consoleParameter_list(): ConsoleParameterContext[] {
		return this.getTypedRuleContexts(ConsoleParameterContext) as ConsoleParameterContext[];
	}
	public consoleParameter(i: number): ConsoleParameterContext {
		return this.getTypedRuleContext(ConsoleParameterContext, i) as ConsoleParameterContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_consoleParameterList;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitConsoleParameterList) {
			return visitor.visitConsoleParameterList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionCallContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_functionCall;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitFunctionCall) {
			return visitor.visitFunctionCall(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionListContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_expressionList;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitExpressionList) {
			return visitor.visitExpressionList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_expression;
	}
	public override copyFrom(ctx: ExpressionContext): void {
		super.copyFrom(ctx);
	}
}
export class CastContext extends ExpressionContext {
	public _castable!: ExpressionContext;
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public typeCast(): TypeCastContext {
		return this.getTypedRuleContext(TypeCastContext, 0) as TypeCastContext;
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitCast) {
			return visitor.visitCast(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class UnaryIntrospectionOpContext extends ExpressionContext {
	public _scope!: Token;
	public _op!: Token;
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitUnaryIntrospectionOp) {
			return visitor.visitUnaryIntrospectionOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class UnaryOpContext extends ExpressionContext {
	public _op!: Token;
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitUnaryOp) {
			return visitor.visitUnaryOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class LiteralExpressionContext extends ExpressionContext {
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public literal(): LiteralContext {
		return this.getTypedRuleContext(LiteralContext, 0) as LiteralContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitLiteralExpression) {
			return visitor.visitLiteralExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class FunctionCallExpressionContext extends ExpressionContext {
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public functionCall(): FunctionCallContext {
		return this.getTypedRuleContext(FunctionCallContext, 0) as FunctionCallContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitFunctionCallExpression) {
			return visitor.visitFunctionCallExpression(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ArrayContext extends ExpressionContext {
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitArray) {
			return visitor.visitArray(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class IdentifierContext extends ExpressionContext {
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitIdentifier) {
			return visitor.visitIdentifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class SliceContext extends ExpressionContext {
	public _element!: ExpressionContext;
	public _start!: ExpressionContext;
	public _end!: ExpressionContext;
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitSlice) {
			return visitor.visitSlice(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class TupleIndexOpContext extends ExpressionContext {
	public _index!: Token;
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(CashScriptParser.NumberLiteral, 0);
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitTupleIndexOp) {
			return visitor.visitTupleIndexOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class InstantiationContext extends ExpressionContext {
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public Identifier(): TerminalNode {
		return this.getToken(CashScriptParser.Identifier, 0);
	}
	public expressionList(): ExpressionListContext {
		return this.getTypedRuleContext(ExpressionListContext, 0) as ExpressionListContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitInstantiation) {
			return visitor.visitInstantiation(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class NullaryOpContext extends ExpressionContext {
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public NullaryOp(): TerminalNode {
		return this.getToken(CashScriptParser.NullaryOp, 0);
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitNullaryOp) {
			return visitor.visitNullaryOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ParenthesisedContext extends ExpressionContext {
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression(): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, 0) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitParenthesised) {
			return visitor.visitParenthesised(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class BinaryOpContext extends ExpressionContext {
	public _left!: ExpressionContext;
	public _op!: Token;
	public _right!: ExpressionContext;
	constructor(parser: CashScriptParser, ctx: ExpressionContext) {
		super(parser, ctx.parentCtx, ctx.invokingState);
		super.copyFrom(ctx);
	}
	public expression_list(): ExpressionContext[] {
		return this.getTypedRuleContexts(ExpressionContext) as ExpressionContext[];
	}
	public expression(i: number): ExpressionContext {
		return this.getTypedRuleContext(ExpressionContext, i) as ExpressionContext;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitBinaryOp) {
			return visitor.visitBinaryOp(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ModifierContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_modifier;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitModifier) {
			return visitor.visitModifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class LiteralContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public BooleanLiteral(): TerminalNode {
		return this.getToken(CashScriptParser.BooleanLiteral, 0);
	}
	public numberLiteral(): NumberLiteralContext {
		return this.getTypedRuleContext(NumberLiteralContext, 0) as NumberLiteralContext;
	}
	public StringLiteral(): TerminalNode {
		return this.getToken(CashScriptParser.StringLiteral, 0);
	}
	public DateLiteral(): TerminalNode {
		return this.getToken(CashScriptParser.DateLiteral, 0);
	}
	public HexLiteral(): TerminalNode {
		return this.getToken(CashScriptParser.HexLiteral, 0);
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_literal;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitLiteral) {
			return visitor.visitLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class NumberLiteralContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public NumberLiteral(): TerminalNode {
		return this.getToken(CashScriptParser.NumberLiteral, 0);
	}
	public NumberUnit(): TerminalNode {
		return this.getToken(CashScriptParser.NumberUnit, 0);
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_numberLiteral;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitNumberLiteral) {
			return visitor.visitNumberLiteral(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeNameContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public PrimitiveType(): TerminalNode {
		return this.getToken(CashScriptParser.PrimitiveType, 0);
	}
	public BoundedBytes(): TerminalNode {
		return this.getToken(CashScriptParser.BoundedBytes, 0);
	}
	public UnboundedBytes(): TerminalNode {
		return this.getToken(CashScriptParser.UnboundedBytes, 0);
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_typeName;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitTypeName) {
			return visitor.visitTypeName(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class TypeCastContext extends ParserRuleContext {
	constructor(parser?: CashScriptParser, parent?: ParserRuleContext, invokingState?: number) {
		super(parent, invokingState);
    	this.parser = parser;
	}
	public PrimitiveType(): TerminalNode {
		return this.getToken(CashScriptParser.PrimitiveType, 0);
	}
	public UnboundedBytes(): TerminalNode {
		return this.getToken(CashScriptParser.UnboundedBytes, 0);
	}
	public UnsafeCast(): TerminalNode {
		return this.getToken(CashScriptParser.UnsafeCast, 0);
	}
    public get ruleIndex(): number {
    	return CashScriptParser.RULE_typeCast;
	}
	// @Override
	public accept<Result>(visitor: CashScriptVisitor<Result>): Result {
		if (visitor.visitTypeCast) {
			return visitor.visitTypeCast(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
