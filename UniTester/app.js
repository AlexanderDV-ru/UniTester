var devMode = true

var express = require('express')
var http = require('http')
var path = require('path')
var fs = exports.fs = require('fs')
var bodyParser = require("body-parser")
var iconv = require('iconv-lite')
var accepts = require('accepts')
var packageJson = require('./package.json')

var application = express()

var programName = exports.programName = packageJson.name
var programVersion = exports.programVersion = packageJson.version
var programAuthors = exports.programAuthors = packageJson.authors
var program = exports.program = programName + " v" + programVersion + " by " + programAuthors

var urlencodedParser = bodyParser.urlencoded(
{
	extended : false
}), useNewParser =
{
	useNewUrlParser : true
}

var mongoDBmodule = require("mongodb")
var mongoClient = mongoDBmodule.MongoClient
var url = "mongodb://localhost:27017/"

var mongoDBClient

var callingUrls = []

// all environments
application.set('port', process.env.PORT || 2222)
application.set('views', __dirname + '/public/views')
application.locals.basedir = application.get('views')
application.set('view engine', 'pug')
application.use(express.favicon())
if (devMode)
	application.use(express.logger('dev'))
application.use(express.bodyParser())
application.use(express.methodOverride())
application.use(application.router)

if (devMode)
	application.use(express.errorHandler())

var hashCode = exports.hashCode = function(object)
{
	var hash = 0
	if (typeof (object) === 'string')
		for (var i = 0; i < object.length; i++)
		{
			hash = ((hash << 5) - hash) + object.charCodeAt(i)
			hash = hash & hash
		}
	else for ( var key in object)
	{
		hash = ((hash << 5) - hash) + object[key].hashCode()
		hash = hash & hash
	}
	return hash
}

var getMsgs = exports.getMsgs = function(language, path)
{
	var messages = fs.readFileSync((path ? path : "public/messages") + "/" + language + ".lang", "utf8").split("\n")
	var msgs = {}
	for (var v = 0; v < messages.length; v++)
		if (messages[v].indexOf("//") !== -1 ? messages[v].indexOf("//") > messages[v].indexOf("'") : true)
			if (messages[v].indexOf("'") !== -1 && messages[v].split(/':[\t ]+'/).length > 1)
				if (messages[v].indexOf("'") < messages[v].split(/':[\t ]+'/)[0].length)
					if (messages[v].indexOf(/':[\t ]+'/) + (messages[v].length - messages[v].replace(/':[\t ]+'/, '').length) < messages[v].lastIndexOf("'"))
					{
						var key = messages[v].substring(messages[v].indexOf('\'') + 1).split(/':[\t ]+'/)[0]
						var value = messages[v].substring(0, messages[v].lastIndexOf('\'')).split(/':[\t ]+'/)[1]
						for ( var key2 in msgs)
							value = value.replace(new RegExp("\\#\\{\\$msgs\\$\\." + key2 + "\\}", "g"), msgs[key2])
						msgs[key] = value
					}
	return msgs
}

function replaceMsgs(text, language)
{
	language = language || "ru_ru"
	var msgs = getMsgs(language);
	for ( var key in msgs)
		text = text.replace(new RegExp("\\$msg\\." + key + "\\$", "g"), msgs[key]);
	return text;
}

var defaultOnNotSignedIn = function(request, response, perms, account)
{
	response.status(401);
	response.redirect("/signin/error/signinToGoToThisPage");
}, defaultOnNotPerms = function(request, response, perms, account)
{
	if (devMode)
	{
		response.status(403);
		response.render("err403",
		{
			data :
			{
				userLogin : account.login,
				userSurname : account.surname,
				userName : account.name,
				userSecondName : account.secondName,
			},

			requestQuery : request.query || {},
			$msgs$ : getMsgs("ru_ru")
		})
	}
	else
	{
		response.status(404);
		response.render("err404",
		{
			data :
			{
				userLogin : account.login,
				userSurname : account.surname,
				userName : account.name,
				userSecondName : account.secondName,
			},

			requestQuery : request.query || {},
			$msgs$ : getMsgs("ru_ru")
		})
	}
};

function checkSignedIn(request, response, onTrue, perms, onNotPerms, onNotSignedIn)
{
	var b = false;
	for (var v = 0; v < callingUrls.length; v++)
		if (callingUrls[v].session == request.connection.remoteAddress)
		{
			b = true;
			callingUrls[v].callingUrl = request.url;
		}
	if (!b)
		callingUrls.push(
		{
			session : request.connection.remoteAddress,
			callingUrl : request.url
		});
	get("users", function(err, users)
	{
		var user = updateUsersAndGetBySession(users, request.connection.remoteAddress, accepts(request).languages());
		if (user)
			get("accounts", function(err, accounts)
			{
				getAccountPerms(accounts[0], function(allPerms)
				{
					if (perms ? !hasPerms(allPerms, perms) : false)
					{
						if (onNotPerms)
							onNotPerms(request, response, allPerms, accounts[0], user);
						else defaultOnNotPerms(request, response, allPerms, accounts[0], user);
						console.warn(user);
						console.warn(" requests page '" + request.url + "' without perms to access!");
					}
					else if (onTrue)
						return onTrue(request, response, allPerms, accounts[0], user);
				});
			},
			{
				login : new RegExp("^" + user.login + "$", "i")
			});
		else if (onNotSignedIn)
			return onNotSignedIn(request, response);
		else return defaultOnNotSignedIn(request, response);
	});
}

function getHasPerms(userPerms, testPerms)
{
	var hasPerms = []
	if (userPerms)
	{
		for (var v2 = 0; v2 < testPerms.length; v2++)
			if (testPerms[v2] !== "")
			{
				for (var v = 0; v < hasPerms.length; v++)
					if (hasPerms[v] == testPerms[v2])
						continue
				for (var v = 0; v < userPerms.length; v++)
					if (userPerms[v].indexOf(testPerms[v2]) == 0)
					{
						hasPerms.push(testPerms[v2])
						break
					}
			}
	}
	return hasPerms
}

function hasPerms(userPerms, testPerms)
{
	return testPerms.length === getHasPerms(userPerms, testPerms).length
}

var unsignTime = 30 * 60 * 1000;

function updateUsersAndGetBySession(users, session, languages)
{
	var user;
	for (var v = 0; v < users.length; v++)
	{
		var timeFromActive = new Date().getTime() - users[v].time;
		if (timeFromActive > unsignTime || users[v].session === session)
			deleteUser(users[v]);
		if (!user)
			if (timeFromActive <= unsignTime)
				if (users[v].session === session)
				{
					console.log(users[v]);
					console.log(" updated after " + timeFromActive + "ms");
					addUser(user = new dbInterface.User(users[v].login, session, new Date().getTime(), users[v].languages || languages));
				}
	}
	return user;
}

function handleAppFunc(paths, onTrue, perms, onNotPerms, onNotSignedIn, uncheckedMode, appFuncType)
{
	if (typeof (paths) === "string" || paths instanceof RegExp)
		paths = [ paths ];
	var func = uncheckedMode ? onTrue : function(request, response)
	{
		checkSignedIn(request, response, onTrue, perms, onNotPerms, onNotSignedIn);
	};
	for (var v = 0; v < paths.length; v++)
		if (appFuncType === "POST")
			application.post(paths[v], urlencodedParser, func);
		else application.get(paths[v], urlencodedParser, func);
}

function post(paths, onTrue, perms, onNotPerms, onNotSignedIn, uncheckedMode)
{
	handleAppFunc(paths, onTrue, perms, onNotPerms, onNotSignedIn, uncheckedMode, "POST");
}

function get(paths, onTrue, perms, onNotSignedIn, onNotPerms, uncheckedMode)
{
	handleAppFunc(paths, onTrue, perms, onNotPerms, onNotSignedIn, uncheckedMode, "GET");
}

function addUser(user)
{
	collection("users").insertOne(user);
}
function deleteUser(user)
{
	collection("users").deleteOne(user);
}

function toRegExpWithText(text, flags)
{
	text = text + ""
	return new RegExp(toRegExpText(text), flags)
}

function getUserLanguage(user, dir)
{
	var d = fs.readdirSync(dir);
	for (var v = 0; v < user.languages.length; v++)
		for (var v2 = 0; v2 < d.length; v2++)
			if (d[v2].toLowerCase().indexOf(user.languages[v]) !== -1)
				return d[v2].toLowerCase().substring(0, 5);
}

get([ '[^]+[.]css', '[^]+[.]ico', '[^]+[.]js', '/robots[.]txt' ], function(request, response)
{
	response.end(fs.readFileSync("public" + request.url, "utf8"))
}, undefined, undefined, undefined, true)

get([ '/signin', '/signin/info/[^/\?]+', '/signin/error/[^/\?]+', '/signin/ok/[^/\?]+' ], function(request, response)
{
	response.render("signin",
	{
		data :
		{
			info : "",
			ok : "",
			error : function()
			{
				switch (request.url.split('/')[3])
				{
					case 'signinFailed':
						return "Signin failed!";
					case "signinToGoToThisPage":
						return "Sign in to go to this page!";
					default:
						return "";
				}
			}(),

			userLogin : null,
			userSurname : null,
			userName : null,
			userSecondName : null,
		},

		requestQuery : request.query || {},
		$msgs$ : getMsgs("ru_ru")
	});
}, undefined, undefined, undefined, true)

post([ '/signin', '/signin/info/[^/\?]+', '/signin/error/[^/\?]+', '/signin/ok/[^/\?]+' ], function(request, response)
{
	if (!request.body)
		return response.sendStatus(400);
	get("users", function(err, users)
	{
		deleteUser(updateUsersAndGetBySession(users, undefined));
	});
	get("accounts", function(err, accounts)
	{
		var bool = false;
		for (var v = 0; v < accounts.length; v++)
		{
			if (accounts[v].login.toLowerCase() === request.body.login.toLowerCase() && accounts[v].passwordHash === hashCode(request.body.password))
			{
				addUser(new dbInterface.User(request.body.login, request.connection.remoteAddress, new Date().getTime(), accepts(request).languages()));

				for (var v = 0; v < callingUrls.length; v++)
					if (callingUrls[v].session == request.connection.remoteAddress)
						if (callingUrls[v].callingUrl.indexOf("signin") === -1 && callingUrls[v].callingUrl.indexOf("signout") === -1)
							return response.redirect(callingUrls[v].callingUrl)
				return response.redirect("/")
			}
		}
		response.redirect("/signin/error/signinFailed");
	});
}, undefined, undefined, undefined, true)

get([ '/accounts/management', '/accounts/management/info/[^/\?]+/[^/\?]+', '/accounts/management/info/[^/\?]+', '/accounts/management/error/[^/\?]+/[^/\?]+', '/accounts/management/error/[^/\?]+', '/accounts/management/ok/[^/\?]+/[^/\?]+', '/accounts/management/ok/[^/\?]+' ], function(request, response, allPerms, account)
{
	get("accounts", function(err, accounts1)
	{
		var info = function()
		{
			switch (request.url.split(new RegExp("[/\?]"))[4])
			{
				default:
					return "";
			}
		}();
		var error = function()
		{
			switch (request.url.split(new RegExp("[/\?]"))[4])
			{
				case "passwordLengthCantBeLessThan10":
					return "Password length can't be less than 10!";
				case "passwordLengthCantBeGreaterThan30":
					return "Password length can't be greater than 30!";
				case "loginLengthCantBeLessThan5":
					return "Login length can't be less than 5!";
				case "loginLengthCantBeGreaterThan30":
					return "Login length can't be greater than 30!";
				case "loginContainsInvalidSymbols":
					return "Login contains invalid symbols! " + "Login can contain digits, lowercase and uppercase latin letters.";
				case "accountAlreadyExists":
					return "Account already exists!";

				case "notPermsToGiveGroup":
					return "You don't have permissions to give group '" + request.url.split(new RegExp("[/\?]"))[5] + "'";
				case "notPermsToGivePerm":
					return "You don't have permissions to give perm '" + request.url.split(new RegExp("[/\?]"))[5] + "'";
				default:
					return "";
			}
		}();
		var ok = "";
		var accounts = [];
		for (var v = 0; v < accounts1.length; v++)
			accounts.push(accounts1[v].login)
		response.render("accounts/management",
		{
			data :
			{
				info : info,
				error : error,
				ok : ok,

				userLogin : account.login,
				userSurname : account.surname,
				userName : account.name,
				userSecondName : account.secondName,

				accounts : accounts
			},

			requestQuery : request.query || {},
			$msgs$ : getMsgs("ru_ru")
		});
	});
}, [ "accounts.management" ]);

function parseChemicalFormula(formula)
{
	formula = replaceSmallToNormal(formula);
	var chemicalElements = JSON.parse(fs.readFileSync("chemicalElements.json", "utf8"));
	var leftBrackets = 0, rightBreckets = 0;
	for (var v = 0; v < formula.length; v++)
		if (formula[v] == '(')
			leftBrackets++;
		else if (formula[v] == ')')
			rightBreckets++;
	if (leftBrackets != rightBreckets)
		return (
		{
			type : "NotClosedBracketErrorInFormulaException",
			message : "Opened " + leftBrackets + ", but closed " + rightBreckets + "!"
		});

	var elements = {};
	var formulaWithoutBrackets = "";
	{
		var lastBracketIndex = -1, curIndex = 0, bracketsToClose = 0, lastCloseIndex = 0;

		for (var v = 0; v < formula.length; v++)
		{
			var c = formula[v];
			if (c == '(')
			{
				if (lastBracketIndex == -1)
					lastBracketIndex = curIndex;
				bracketsToClose++;
			}
			else if (c == ')')
			{
				bracketsToClose--;
				if (bracketsToClose == 0)
				{
					formulaWithoutBrackets += formula.substring(lastCloseIndex, lastBracketIndex);
					var inBrackets = formula.substring(lastBracketIndex + 1, curIndex);
					var indexStr = "";
					for (var v2 = curIndex + 1; v2 < formula.length; v2++)
						if (formula[v2].replace(/[0-9]/, "") == '')
							indexStr += formula[v2];
						else break;
					var index = indexStr.length == 0 ? 1 : Number.parseInt(indexStr);
					if (index < 1)
						return (
						{
							type : IndexLessThanOneErrorInFormulaException,
							message : "Index of " + inBrackets + " (" + index + ") less than one!"
						});
					var els = parseChemicalFormula(inBrackets)
					for ( var el in els)
						if (!elements[el])
							elements[el] =
							{
								amount : els[el].amount * index,
								element : els[el].element
							}
						else elements[el].amount += els[el].amount * index

					lastBracketIndex = -1;
					lastCloseIndex = curIndex + 1 + indexStr.length;
				}
				else if (bracketsToClose < 0)
					return (
					{
						type : "WrongBracketOrderErrorInFormulaException",
						message : "The bracket is closed before opening!"
					});
			}

			curIndex++;
		}
		formulaWithoutBrackets += formula.substring(lastCloseIndex);
	}

	var formulaDin = formulaWithoutBrackets;
	for (var v = 0; formulaDin.length != 0 && v < 100; v++)
		for ( var elName in chemicalElements)
		{
			var el = chemicalElements[elName];
			if (formulaDin.indexOf(elName) != -1 && (formulaDin + "\n")[formulaDin.indexOf(elName) + elName.length].replace(/[a-z]/, "") !== "")
			{
				var indexStr = "";
				for (var v2 = formulaDin.indexOf(elName) + elName.length; v2 < formulaDin.length; v2++)
					if (formulaDin[v2].replace(/[0-9]/, "") == '')
						indexStr += formulaDin[v2];
					else break;
				var index = indexStr.length == 0 ? 1 : Number.parseInt(indexStr);
				if (index < 1)
					return (
					{
						type : "IndexLessThanOneErrorInFormulaException",
						message : "Index of " + elName + " (" + index + ") less than one!"
					});
				var amount = (elements[elName] ? elements[elName].amount : 0) + index;
				elements[elName] =
				{
					amount : amount,
					element : el
				};
				formulaDin = formulaDin.substring(0, formulaDin.indexOf(elName)) + formulaDin.substring(formulaDin.indexOf(elName) + elName.length + indexStr.length);
			}
		}
	return elements
}
function replaceSmallToNormal(formula)
{
	return typeof (formula) === "string" ? formula.replace(/₀/g, "0").replace(/₁/g, "1").replace(/₂/g, "2").replace(/₃/g, "3").replace(/₄/g, "4").replace(/₅/g, "5").replace(/₆/g, "6").replace(/₇/g, "7").replace(/₈/g, "8").replace(/₉/g, "9") : formula
}
function replaceNormalToSmall(formula)
{
	return typeof (formula) === "string" ? formula.replace(/0/g, "₀").replace(/1/g, "₁").replace(/2/g, "₂").replace(/3/g, "₃").replace(/4/g, "₄").replace(/5/g, "₅").replace(/6/g, "₆").replace(/7/g, "₇").replace(/8/g, "₈").replace(/9/g, "₉") : formula
}

function multiply(str, count)
{
	var s = str;
	for (; s.length < str.length * count;)
		s += str[s.length % str.length];
	return s;
}

function doubleToString(number, signs)
{
	if (!signs)
		return number + "";
	number = number + "";
	if (number.indexOf(".") == -1)
		number += ".0";
	return signs == 0 ? Number.parseInt(number + "") : "" + (number + "").split(".")[0] + "." + (number + multiply("0", signs)).split(".")[1].substring(0, signs);
}

function sizeOf(object)
{
	var count = 0;
	for ( var v in object)
		count++;
	return count;
}

function descript(formula, naming, chemicalElementsLanguage, language, signsAfterComma)
{
	formula = replaceSmallToNormal(formula);
	var chemicalElementsNames = getMsgs(chemicalElementsLanguage, "chemicalElementsNames");
	var msgs = getMsgs(language);

	var elements = JSON.parse(fs.readFileSync("chemicalElements.json", "utf8"));

	var b = false;
	for (var v = 0; v < formula.length; v++)
		if (formula[v].replace(/[a-z0-9A-Z()]/g, "") != "")
			return msgs["mustBeFormula"].replace("%1", formula);
		else if (formula[v].replace(/[A-Z]/g, "") === "")
			b = true;
	if (!b)
		return msgs["mustBeFormula"].replace("%1", formula);
	var containsInert = false;

	var elements = parseChemicalFormula(formula);

	if (!(elements instanceof Array))
		if (elements.type === "IndexLessThanOneErrorInFormulaException")
			return msgs["indexLessThanOneErrorInFormula"].replace(/%1/g, e1.message.substring(e1.message.indexOf(" (") + 2, e1.message.indexOf(") "))).replace(/%2/g, e1.message.substring("Index of ".length(), e1.message.indexOf(" (")));
		else if (elements.type === "InertGasCompoundErrorInFormulaException")
			return msgs["inertGasCompoundErrorInFormula"];
		else if (elements.type === "NotClosedBracketErrorInFormulaException")
			return msgs["inertGasCompoundErrorInFormula"];
		else if (elements.type === "WrongBracketOrderErrorInFormulaException")
			return msgs["wrongBracketOrderErrorInFormula"];

	var molecularMass = 0;
	for ( var el in elements)
		molecularMass += elements[el].element.mass * elements[el].amount;
	var elementsStr = "";
	var amountStr = "";
	var molecularMassStr = "";
	var propStr = "";
	var massDolesStr = "";
	var used = {};
	var first = true;
	for ( var el in elements)
	{
		elementsStr += (first ? "" : ", ") + chemicalElementsNames[elements[el].element.symbol] + "(" + elements[el].element.symbol + ")";
		amountStr += (first ? "" : ", ") + chemicalElementsNames[elements[el].element.symbol] + "(" + elements[el].element.symbol + ")" + " - " + elements[el].amount + " " + msgs["atoms"];
		molecularMassStr += (first ? "" : " + ") + doubleToString(elements[el].element.mass * elements[el].amount, signsAfterComma) + "(" + elements[el].element.symbol + ", " + doubleToString(elements[el].element.mass, signsAfterComma) + " * " + elements[el].amount + ")";
		var first2 = true;
		for ( var el2 in elements)
			if (el != el2)
				if (used[el2] ? !used[el2][el] : true)
				{
					propStr += (first && first2 ? "" : ", ") + elements[el].element.symbol + ":" + elements[el2].element.symbol + "=" + doubleToString(elements[el].element.mass * elements[el].amount, signsAfterComma) + ":" + doubleToString(elements[el2].element.mass * elements[el2].amount, signsAfterComma);
					if (!used[el])
						used[el] = [];
					used[el].push(el2);
					first2 = false;
				}
		massDolesStr += (first ? "" : ", ") + elements[el].element.symbol + "~" + doubleToString(elements[el].element.mass * elements[el].amount / molecularMass * 100, signsAfterComma) + "%";
		first = false;
	}
	molecularMassStr += " = " + doubleToString(molecularMass, signsAfterComma);
	var description = "\t" + replaceNormalToSmall(formula) + "\n";
	description += "1. " + msgs["specificSubstance"].replace("%1", naming) + "\n";
	description += "2. " + msgs["qualitativeComposition"].replace("%1", sizeOf(elements) + "").replace("%2", elementsStr) + "\n";
	var cell
	for ( var k in elements)
	{
		cell = elements[k]
		break
	}
	description += "3. " + msgs["substanceType"].replace("%1", (sizeOf(elements) > 1 ? "сложное" : (cell.amount > 1 || isInert(cell.element) ? "простое" : "одиночный атом"))) + "\n"
	description += "4. " + msgs["quantitativeComposition"].replace("%1", amountStr) + "\n"
	description += "5. " + msgs["relativeMolecularMass"].replace("%1", molecularMassStr) + "\n"
	description += "6. " + msgs["elementsMassRatio"].replace("%1", propStr) + "\n"
	description += "7. " + msgs["elementsMassFractions"].replace("%1", massDolesStr)
	return description
}

get('/workspace/utils/subjects/chemistry/formulaDescription', function(request, response, perms, account, user)
{
	collection("namesOfFormulas").find(
	{
		formula : request.query.chemicalFormula
	}).toArray(function(err, results)
	{
		response.render("workspace/utils/subjects/chemistry/formulaDescription.pug",
		{
			data :
			{
				info : function()
				{
				}(),
				ok : function()
				{
				}(),
				error : function()
				{
				}(),

				description : request.query.chemicalFormula ? descript(request.query.chemicalFormula, request.query.naming || results[0] || replaceNormalToSmall(request.query.chemicalFormula), request.query.chemicalElementsLanguage === 'current' ? getUserLanguage(user, "chemicalElementsNames") : 'la_la', getUserLanguage(user, "public/messages"), request.query.signsAfterComma) : "",
				userLogin : account.login,
				userSurname : account.surname,
				userName : account.name,
				userSecondName : account.secondName
			},

			requestQuery : request.query || {},
			$msgs$ : getMsgs("ru_ru")
		})
	})
}, [ "workspace.utils.subjects.chemistry.formulaDescription" ])

get('/info', function(request, response, perms, account, user)
{
	response.render("info.pug",
	{
		data : account ?
		{
			userLogin : account.login,
			userSurname : account.surname,
			userName : account.name,
			userSecondName : account.secondName
		} : {},

		requestQuery : request.query || {},
		$msgs$ : getMsgs("ru_ru")
	})
}, undefined, undefined, undefined, true)

var chemAPI = {}
chemAPI.isInert = function(chemElement)
{
	for (var v = 1, c = 0, count = 0;; v++)
	{
		c = Math.floor(v / 2) + 1
		count += c * c * 2
		if (count === chemElement.id)
			return true
		else if (count > chemElement.id)
			return false
	}
	return false
}

chemAPI.isMetal = function(chemElement)
{
	return chemElement.type.toLowerCase() === "metal" && !chemAPI.isPolumetal(chemElement)
}
chemAPI.isNonmetal = function(chemElement)
{
	return chemElement.type.toLowerCase() === "nonmetal" || chemAPI.isPolumetal(chemElement)
}

chemAPI.isLantanoid = function(chemElement)
{
	return chemElement.id >= 57 && chemElement.id <= 71
}
chemAPI.isActinoid = function(chemElement)
{
	return chemElement.id >= 89 && chemElement.id <= 103
}
chemAPI.isSuperactinoid = function(chemElement)
{
	return chemElement.id >= 121 && chemElement.id <= 153
}
chemAPI.isSuperactinoid2 = function(chemElement)
{
	return chemElement.id >= 171 && chemElement.id <= 203
}

chemAPI.isRadioactive = function(chemElement)
{
	return chemElement.id >= 84 || chemElement.mass >= 209
}

chemAPI.isShelochnie = function(chemElement)
{
	return chemElement.symbol.replace(/(Li|Na|K|Rb|Cs|Fr|Uue)/, "") == ""
}

chemAPI.isShelochnozemelnie = function(chemElement)
{
	return chemElement.symbol.replace(/(Be|Mg|Ca|Sr|Ba|Ra|Ubn)/, "") == ""
}

chemAPI.isGalogen = function(chemElement)
{
	return chemElement.symbol.replace(/(F|Cl|Br|I|At|Ts)/, "") == ""
}

chemAPI.isPolumetal = function(chemElement)
{
	return chemElement.symbol.replace(/(B|Si|Ge|As|Sb|Te|Po)/, "") == ""
}

chemAPI.getTypeGroup = function(chemElement)
{
	return chemAPI.isLantanoid(chemElement) ? "Lantanoid" : chemAPI.isActinoid(chemElement) ? "Actinoid" : chemAPI.isSuperactinoid(chemElement) ? "Superactinoid" : chemAPI.isSuperactinoid2(chemElement) ? "Superactinoid2" : ""
}

post('/saveChemSettings', function(request, response, perms, account, user)
{
	collection('saveChemSettings').findOneAndUpdate(
	{
		login : new RegExp("^" + account.login + "$", "i")
	},
	{
		$set :
		{
			login : account.login,
			data : request.body
		}
	},
	{
		upsert : true
	})
	response.end()
})

get('/workspace/utils/subjects/chemistry/elementInfo/[A-Z][a-z]{0,3}', function(request, response, perms, account, user)
{
	response.render("workspace/utils/subjects/chemistry/elementInfo.pug",
	{
		data :
		{
			userLogin : account.login,
			userSurname : account.surname,
			userName : account.name,
			userSecondName : account.secondName,

			chemicalElement : JSON.parse(fs.readFileSync("chemicalElements.json", "utf8"))[request.url.substring(path.length).split(new RegExp("[/\?]"))[6]],
			localizedChemicalElementsNames : getMsgs("ru_ru", "chemicalElementsNames"),
			chemicalElementsNames : function()
			{
				var vs = {}
				for (var v = 0; v < fs.readdirSync("chemicalElementsNames").length; v++)
					vs[fs.readdirSync("chemicalElementsNames")[v].substring(0, 5)] = getMsgs(fs.readdirSync("chemicalElementsNames")[v].substring(0, 5), "chemicalElementsNames")
				return vs
			}(),
			chemAPI : chemAPI
		},

		requestQuery : request.query || {},
		$msgs$ : getMsgs("ru_ru")
	})
}, [ "workspace.utils.subjects.chemistry.elementInfo" ])

get('/workspace/utils/subjects/chemistry/periodicTable', function(request, response, perms, account, user)
{
	collection('saveChemSettings').find(
	{
		login : new RegExp("^" + account.login + "$", "i")
	}).toArray(function(err, saveChemSettings)
	{
		response.render("workspace/utils/subjects/chemistry/periodicTable.pug",
		{
			data :
			{
				userLogin : account.login,
				userSurname : account.surname,
				userName : account.name,
				userSecondName : account.secondName,

				chemicalElements : JSON.parse(fs.readFileSync("chemicalElements.json", "utf8")),
				localizedChemicalElementsNames : getMsgs("ru_ru", "chemicalElementsNames"),
				chemicalElementsNames : function()
				{
					var vs = {}
					for (var v = 0; v < fs.readdirSync("chemicalElementsNames").length; v++)
						vs[fs.readdirSync("chemicalElementsNames")[v].substring(0, 5)] = getMsgs(fs.readdirSync("chemicalElementsNames")[v].substring(0, 5), "chemicalElementsNames")
					return vs
				}(),
				chemAPI : chemAPI,
				periodicTableSettings : !saveChemSettings[0] ? {} : saveChemSettings[0].data
			},

			requestQuery : request.query || {},
			$msgs$ : getMsgs("ru_ru")
		})
	})
}, [ "workspace.utils.subjects.chemistry.periodicTable" ])

function getGlobalMenu()
{
	return (
	{
		utils :
		{
			text : "Utils",
			menuItems :
			{
				subjects :
				{
					text : "Subjects",
					menuItems :
					{
						chemistry :
						{
							text : "Chemistry",
							href : "/workspace/utils/subjects/chemistry",
							menuItems :
							{
								formulaDescription :
								{
									text : "Formula Description",
									href : "/workspace/utils/subjects/chemistry/formulaDescription"
								},
								periodicTable :
								{
									text : "periodicTable",
									href : "/workspace/utils/subjects/chemistry/periodicTable"
								}
							}
						}
					}
				}
			}
		}
	})
}

get('/workspace/utils/subjects/chemistry', function(request, response, perms, account, user)
{
	response.render("workspace/utils/subjects/chemistry.pug",
	{
		data :
		{
			menues :
			{
				chemistry : getGlobalMenu().utils.menuItems.subjects.menuItems.chemistry
			}
		},

		requestQuery : request.query || {},
		$msgs$ : getMsgs("ru_ru")
	})
}, [ "workspace.utils.subjects.chemistry" ])

get([ '/accounts/management/exists/[a-zA-Z0-9]+', '/accounts/management/exists/[a-zA-Z0-9]+/info/[^/\?]+', '/accounts/management/exists/[a-zA-Z0-9]+/error/[^/\?]+', '/accounts/management/exists/[a-zA-Z0-9]+/ok/[^/\?]+' ], function(request, response, perms, account)
{
	var path = '/accounts/management/exists';
	var urlLogin = request.url.substring(path.length).split(new RegExp("[/\?]"))[1];
	get("accounts", function(err, accounts)
	{
		var info = "";
		var error = function()
		{
			switch (request.url.split('/')[6])
			{
				case "passwordchangefailed":
					return "Password changing failed!";
				default:
					return "";
			}
		}();
		var ok = function()
		{
			switch (request.url.split('/')[6])
			{
				case "passwordchanged":
					return "Password changed!";
				default:
					return "";
			}
		}();
		if (accounts.length !== 0)
			response.render("accounts/management/exists",
			{
				data :
				{
					info : info,
					ok : ok,
					error : error,

					userLogin : account.login,
					userSurname : account.surname,
					userName : account.name,
					userSecondName : account.secondName,
					accountLogin : urlLogin
				},

				requestQuery : request.query || {},
				$msgs$ : getMsgs("ru_ru")
			});
		else
		{
			response.status(404);
			response.render("accounts/management/err404",
			{
				data :
				{
					info : info,
					ok : ok,
					error : error,

					userLogin : account.login,
					userSurname : account.surname,
					userName : account.name,
					userSecondName : account.secondName,
					accountLogin : urlLogin
				},

				requestQuery : request.query || {},
				$msgs$ : getMsgs("ru_ru")
			});
		}
	},
	{
		login : new RegExp("^" + urlLogin + "$", "i")
	});
}, [ "accounts.management.exists" ]);

get('/accounts/management/changepassword/[a-zA-Z0-9]+', function(request, response, perms, account)
{
	var path = '/accounts/management/changepassword';
	var urlLogin = request.url.substring(path.length).split(new RegExp("[/\?]"))[1];
	get("accounts", function(err, accounts)
	{
		if (accounts.length !== 0)
			response.render("accounts/management/changepassword",
			{
				data :
				{
					userLogin : account.login,
					userSurname : account.surname,
					userName : account.name,
					userSecondName : account.secondName,
					accountLogin : urlLogin
				},

				requestQuery : request.query || {},
				$msgs$ : getMsgs("ru_ru")
			});
		else
		{
			response.status(404);
			response.render("accounts/management/err404",
			{
				data :
				{
					userLogin : account.login,
					userSurname : account.surname,
					userName : account.name,
					userSecondName : account.secondName,
					accountLogin : urlLogin
				},

				requestQuery : request.query || {},
				$msgs$ : getMsgs("ru_ru")
			});
		}
	},
	{
		login : new RegExp("^" + urlLogin + "$", "i")
	});
}, [ "accounts.management.exists.changepassword" ]);

post('/accounts/management/changepassword/[a-zA-Z0-9]+', function(request, response, perms, account)
{
	if (!request.body)
		return response.sendStatus(400);
	var path = '/accounts/management/changepassword';
	var urlLogin = request.url.substring(path.length).split(new RegExp("[/\?]"))[1];
	get("accounts", function(err, accounts)
	{
		if (accounts.length > 0)
		{
			collection("accounts").findOneAndUpdate(
			{
				login : new RegExp("^" + urlLogin + "$", "i")
			},
			{
				$set :
				{
					login : urlLogin,
					passwordHash : hashCode(request.body.password)
				}
			});
			response.redirect('/accounts/management/exists/' + urlLogin + "/ok/passwordchanged");
		}
	},
	{
		login : new RegExp("^" + urlLogin + "$", "i")
	});
}, [ "accounts.management.exists.changepassword" ]);

post('/accounts/management/create', function(request, response, perms, account)
{
	if (!request.body)
		return response.sendStatus(400);
	var groupsNames = request.body.groupsNames.replace(new RegExp(" ", 'g'), "").replace(new RegExp("\r\n", 'g'), "\n").replace(new RegExp("\r", 'g'), "\n").split("\n");
	var perms = request.body.perms.replace(new RegExp(" ", 'g'), "").replace(new RegExp("\r\n", 'g'), "\n").replace(new RegExp("\r", 'g'), "\n").split("\n");
	get("users", function(err, users)
	{
		getUserPerms(users[0], function(userPerms)
		{
			for (var v = 0; v < groupsNames.length; v++)
				if (groupsNames[v] !== "")
					for (var v2 = 0; v2 < userPerms.length; v2++)
						if (userPerms[v2].indexOf("accounts.management.group.give." + groupsNames[v]) === 0)
							break;
						else if (v2 === userPerms.length - 1)
							return response.redirect('/accounts/management/error/notPermsToGiveGroup/' + groupsNames[v])
			for (var v = 0; v < perms.length; v++)
				if (perms[v] !== "")
					for (var v2 = 0; v2 < userPerms.length; v2++)
						if (userPerms[v2].indexOf("accounts.management.perm.give." + perms[v]) === 0)
							break;
						else if (v2 === userPerms.length - 1)
							return response.redirect('/accounts/management/error/notPermsToGivePerm/' + perms[v])
			dbInterface.createAccount(new dbInterface.Account(request.body.login, hashCode(request.body.password), groupsNames, perms), request.body.password, function()
			{
				response.redirect('/accounts/management/error/accountAlreadyExists');
			}, function(cause)
			{
				response.redirect('/accounts/management/error/' + cause);
			}, function()
			{
				response.redirect('/accounts/management/exists/' + request.body.login + "/ok/created");
			});
		});
	},
	{
		session : request.connection.remoteAddress
	});
}, [ "accounts.management.create" ])

application.get("/", function(request, response)
{
	response.redirect("/workspace")
})
var replaces_En_Ru =
{
	"qQ" : "й",
	"wW" : "ц",
	"eE" : "у",
	"rR" : "к",
	"tT" : "е",
	"`~" : "е",
	"yY" : "н",
	"uU" : "г",
	"iI" : "ш",
	"oO" : "щ",
	"pP" : "з",
	"[{" : "х",
	"]}" : "ъ",
	"aA" : "ф",
	"sS" : "ы",
	"dD" : "в",
	"fF" : "а",
	"gG" : "п",
	"hH" : "р",
	"jJ" : "о",
	"kK" : "л",
	"lL" : "д",
	";:" : "ж",
	"'\"" : "э",
	"zZ" : "я",
	"xX" : "ч",
	"cC" : "с",
	"vV" : "м",
	"bB" : "и",
	"nN" : "т",
	"mM" : "ь",
	",<" : "б",
	".>" : "ю"
}

function puntoSwitch(account, text, replaces)
{
	replaces = replaces || replaces_En_Ru
	text = text + ""
	for ( var key in replaces)
		for (var v = 0; v < key.length; v++)
			text = text.replace(new RegExp("[" + key[v] + "]", "gmi"), replaces[key])
	return text
}

function toRegExpText(text)
{
	text = text + ""
	var result = ""
	for (var v = 0; v < text.length; v++)
		result += "[" + text[v] + "]"
	return result
}

function toFindRegExpWithText(text, flags)
{
	text = text + ""
	return new RegExp("^" + toRegExpText(text) + "$", flags)
}

get('/workspace', function(request, response, perms, account)
{
	var groupsPerms = [];
	for (var v = 0; v < perms.length; v++)
		if (perms[v].indexOf("workspace.") === 0 && perms[v].split(".").length === 2)
		{
			var b = false
			for (var v1 = 0; v1 < groupsPerms.length; v1++)
				if (groupsPerms[v1] === perms[v].split(".")[1])
					b = true
			if (!b)
				groupsPerms.push(perms[v].split(".")[1])
		}
	switch (groupsPerms.length > 1 ? null : groupsPerms[0])
	{
		case "admin":
		case "student":
		case "teacher":
		case "dataCollector":
			return response.redirect("/workspace/" + groupsPerms[0])
		default:
			return response.render("workspace",
			{
				data :
				{
					userLogin : account.login,
					userSurname : account.surname,
					userName : account.name,
					userSecondName : account.secondName,

					groupsPerms : groupsPerms
				},

				requestQuery : request.query || {},
				$msgs$ : getMsgs("ru_ru")
			})
	}
}, [ "workspace" ])

get('/haspermissions', function(request, response, perms, account)
{
	var anyOne = false;
	for ( var key in request.query)
		if (key.indexOf("checkingPerm") == 0)
		{
			anyOne = true;
			var has = false
			for (var v = 0; v < perms.length; v++)
				if (perms[v] == request.query[key])
				{
					has = true
					break
				}
			if (!has)
				response.end("false")
		}
	if (anyOne)
		response.end("true")
	else response.end("undefined")
})
get('/haspermissions/[A-Za-z0-9]+', function(request, response, perms, account)
{
	get("accounts", function(err, accounts)
	{
		if (accounts[0])
			getAccountPerms(accounts[0], function(perms)
			{
				var anyOne = false;
				for ( var key in request.query)
					if (key.indexOf("checkingPerm") == 0)
					{
						var has = false
						for (var v = 0; v < perms.length; v++)
							if (perms[v] == request.query[key])
							{
								has = true
								break
							}
						if (!has)
							response.end("false")
					}
				if (anyOne)
					response.end("true")
				else response.end("undefined")
			})
		else response.end("undefined")
	},
	{
		login : new RegExp("^" + request.url.substring(path.length).split(new RegExp("[/\?]"))[1] + "$", "i")
	})
}, [ "accounts.management.perms.check" ])
get('/getunitsbyregion', function(request, response, perms, account, user)
{
	if (request.query.region)
		collection("units").find(
		{
			regions : toFindRegExpWithText(request.query.region)
		}).toArray(function(err, units)
		{
			var unitsNames = []
			for (var v = 0; v < units.length; v++)
				unitsNames.push(units[v].name)
			response.send(JSON.stringify(unitsNames))
		})
})
get('/getordersnames', function(request, response, perms, account, user)
{
	collection("orders").find(
	{
		login : new RegExp("^" + account.login + "$", "i")
	}).toArray(function(err, orders)
	{
		var ordersNames = []
		for (var v = 0; v < orders.length; v++)
			ordersNames.push(orders[v].orderName)
		response.send(JSON.stringify(ordersNames))
	})
})
post('/createorder', function(request, response, perms, account, user)
{
	if (!request.body)
		return response.sendStatus(400)
	if (request.body.orderName)
	{
		collection("orders").insertOne(
		{
			orderName : request.body.orderName,
			login : new RegExp("^" + account.login + "$", "i")
		}, function(err, results)
		{
			response.end()
		})
	}
	else return response.status(400)
})
get('/getunitinfo', function(request, response, perms, account, user)
{
	if (request.query.name)
		collection("units").find(
		{
			name : toFindRegExpWithText(request.query.name)
		}).toArray(function(err, units)
		{
			var unitInfo = []
			for ( var key in units[0])
				if (hasPerms(perms, [ "units.edit." + key ]))
					unitInfo.push(
					{
						name : key,
						editable : true,
						value : units[0][key]
					})
				else if (hasPerms(perms, [ "units.get." + key ]))
					unitInfo.push(
					{
						name : key,
						editable : false,
						value : units[0][key]
					})
			response.send(JSON.stringify(unitInfo))
		})
})
get('/getdata', function(request, response, perms, account, user)
{
	if (request.query.existOrdersSearch)
		collection("orders").find(
		{
			orderName : new RegExp("^" + toRegExpText(request.query.existOrdersSearch) + "|" + "^" + toRegExpText(puntoSwitch(account, request.query.existOrdersSearch)), 'i'),
			login : new RegExp("^" + account.login + "$", "i")
		}).toArray(function(err, orders)
		{
			response.end(JSON.stringify(orders));
		});
	else if (request.query.hintSearch)
		collection("hints").find(
		{
			hint : new RegExp("^" + toRegExpText(request.query.hintSearch) + "|" + "^" + toRegExpText(puntoSwitch(account, request.query.hintSearch)), 'i')
		}).toArray(function(err, hints)
		{
			var data = "";
			for (var v = 0; v < hints.length; v++)
				data += hints[v].hint + "&"
		});
	else if (request.query.orderFormSearch)
		collection("orderForms").find(
		{
			$or : [
			{
				naming : new RegExp(toRegExpText(request.query.orderFormSearch) + "|" + toRegExpText(puntoSwitch(account, request.query.orderFormSearch)), 'i')
			},
			{
				mnn : new RegExp(toRegExpText(request.query.orderFormSearch) + "|" + toRegExpText(puntoSwitch(account, request.query.orderFormSearch)), 'i')
			},
			{
				distributor : new RegExp(toRegExpText(request.query.orderFormSearch) + "|" + toRegExpText(puntoSwitch(account, request.query.orderFormSearch)), 'i')
			},
			{
				manufacturer : new RegExp(toRegExpText(request.query.orderFormSearch) + "|" + toRegExpText(puntoSwitch(account, request.query.orderFormSearch)), 'i')
			} ]

		}).toArray(function(err, orderForms)
		{
			var data = "";
			var count = 0;
			var onAllPricesCounted = function()
			{
				for (var v = 0; v < orderForms.length; v++)
					for ( var key in orderForms[v])
						if (key != '_id')
							data += v + "_" + key + "=" + orderForms[v][key] + "&";
				response.end(data);
			}
			function func(v)
			{
				collection("orderOffers").find(
				{
					orderForm : new RegExp(toRegExpText(orderForms[v].naming) + "|" + toRegExpText(puntoSwitch(account, orderForms[v].naming)), 'i')
				}).toArray(function(err, orderOffers)
				{
					for (var v2 = 0; v2 < orderOffers.length; v2++)
						if (typeof (orderOffers[v2].price) === 'number' && !Number.isNaN(orderOffers[v2].price))
							if (typeof (orderForms[v].minPrice) === 'number' && !Number.isNaN(orderForms[v].minPrice))
								orderForms[v].minPrice = Math.min(orderForms[v].minPrice, orderOffers[v2].price);
							else orderForms[v].minPrice = orderOffers[v2].price;
					count++;
					if (count == orderForms.length)
						onAllPricesCounted();
				});
			}
			for (var vv = 0; vv < orderForms.length; vv++)
				func(vv);
		});
	else if (request.query.orderOfferSearch)
		collection("orderOffers").find(
		{
			orderForm : new RegExp(toRegExpText(request.query.orderOfferSearch) + "|" + toRegExpText(puntoSwitch(account, request.query.orderOfferSearch)), 'i')
		}).toArray(function(err, orderOffers)
		{
			var data = "";
			for (var v = 0; v < orderOffers.length; v++)
				for ( var key in orderOffers[v])
					if (key != '_id')
						data += v + "_" + key + "=" + orderOffers[v][key] + "&";
			response.end(data);
		});
	else if (request.query.orderName)
		collection("orders").find(
		{
			orderName : new RegExp(toRegExpText(request.query.orderName) + "|" + toRegExpText(puntoSwitch(account, request.query.orderName)), 'i'),
			login : new RegExp("^" + account.login + "$", "i")
		}).toArray(function(err, orders)
		{
			var data = "";
			if (orders[0] ? orders[0].data : false)
			{
				var orderData = orders[0].data;
				for (var v = 0; v < orderData.length; v++)
					for ( var key in orderData[v])
						if (key != '_id')
							data += v + "_" + key + "=" + orderData[v][key] + "&";
			}
			response.end(data);
		});
	else if (request.query.nameOfTableStructure)
		collection("settings").find(
		{
			login : new RegExp("^" + account.login + "$", "i")
		}).toArray(function(err, settings)
		{
			var data = []
			var savedStructure
			var defaultStructure
			switch (request.query.nameOfTableStructure)
			{
				case "orderForms":
					savedStructure = settings[0] ? settings[0].orderFormsStructure : []
					defaultStructure = [
					{
						name : 'markers',
						head : '$msg.markers$'
					},
					{
						name : 'externalNote',
						head : '$msg.externalNote$',
						editType :
						{
							$hasPerms : [
							{
								perms : [ "edit.externalNote" ],
								value : "text"
							} ]
						}
					},
					{
						name : 'internalNote',
						head : '$msg.internalNote$',
						editType :
						{
							$hasPerms : [
							{
								perms : [ "edit.internalNote" ],
								value : "text"
							} ]
						}
					},
					{
						name : 'naming',
						head : '$msg.naming$',
						selectableClassType : "textOfSelectable"
					},
					{
						name : 'minPrice',
						head : '$msg.minPrice$'
					} ]
					break

				case "orderOffers":
					savedStructure = settings[0] ? settings[0].orderOffersStructure : []
					defaultStructure = [
					{
						name : 'markers',
						head : '$msg.markers$'
					},
					{
						name : 'distributorNote',
						head : '$msg.distributorNote$'
					},
					{
						name : 'naming',
						head : '$msg.naming$'
					},
					{
						name : 'manufacturer',
						head : '$msg.manufacturer$'
					},
					{
						name : 'distributor',
						head : '$msg.distributor$'
					},
					{
						name : 'obliqueness',
						head : '$msg.obliqueness$'
					},
					{
						name : 'inStock',
						head : '$msg.inStock$'
					},
					{
						name : 'expirationDate',
						head : '$msg.expirationDate$'
					},
					{
						name : 'priceOfStateRegister',
						head : '$msg.priceOfStateRegister$'
					},
					{
						name : 'price',
						head : '$msg.price$'
					},
					{
						name : 'order',
						head : '$msg.order$',
						editType :
						{
							$hasPerms : [
							{
								perms : [ "edit.order" ],
								value : "number"
							} ]
						}
					},
					{
						name : 'cost',
						head : '$msg.cost$'
					},
					{
						name : 'id',
						head : '$msg.id$'
					} ]
					break

				default:
					return response.status(400)
					break
			}
			function func(defaultElement)
			{
				var element
				var num
				for (var v2 = 0; v2 < savedStructure.length; v2++)
					if (savedStructure[v2].name === defaultElement.name)
					{
						element = savedStructure[v2]
						num = v2
					}
				if (!element)
					element = defaultElement
				if (!num)
					num = data.length
				data[num] = {}
				for ( var key in defaultElement)
				{
					var value;
					if (typeof (element[key]) === typeof (defaultElement[key]))
						value = element[key]
					else value = defaultElement[key]
					if (typeof (value) !== "object")
						data[num][key] = value
					else for ( var key2 in value)
						if (key2[0] === "$")
							switch (key2.toLowerCase().substring(1))
							{
								case "hasperms":
									for (var v = 0; v < value[key2].length; v++)
										if (hasPerms(perms, value[key2][v].perms))
											data[num][key] = value[key2][v].value;
									break
							}
				}
			}

			for (var v = 0; v < defaultStructure.length; v++)
				func(defaultStructure[v])
			response.end(replaceMsgs(JSON.stringify(data), getUserLanguage(user, "public/messages")))
		});
	else return response.status(400)
}, [ "workspace.student" ]);

post('/postdata', function(request, response, perms, account)
{
	if (!request.body)
		return response.sendStatus(400)
	if (request.body.options)
	{
	}
	else if (request.body.orderName && request.body.orderData)
	{
		collection("orders").find(
		{
			orderName : new RegExp(toRegExpText(request.body.orderName) + "|" + toRegExpText(puntoSwitch(account, request.body.orderName)), 'i'),
			login : new RegExp("^" + account.login + "$", "i")
		}).toArray(function(err, objects)
		{
			var orderData = objects[0] && objects[0].data instanceof Array ? objects[0].data : [];
			var vars = request.body.orderData.split(";");
			for (var v = 0; v < vars.length; v++)
			{
				if (!orderData[vars[v].split("=")[0].split("_")[0]])
					orderData[vars[v].split("=")[0].split("_")[0]] = {};
				orderData[vars[v].split("=")[0].split("_")[0]][vars[v].split("=")[0].split("_")[1]] = vars[v].split("=")[1];
			}
			collection("orders").findOneAndUpdate(
			{
				orderName : new RegExp(toRegExpText(request.body.orderName) + "|" + toRegExpText(puntoSwitch(account, request.body.orderName)), 'i'),
				login : new RegExp("^" + account.login + "$", "i")
			},
			{
				$set :
				{
					login : account.login,
					data : orderData
				}
			},
			{
				upsert : true
			})
		})
	}
	else return response.status(400);
}, [ "workspace.student" ]);

get('/workspace/student', function(request, response, perms, account)
{
	response.render("workspace/student",
	{
		data :
		{
			userLogin : account.login,
			userSurname : account.surname,
			userName : account.name,
			userSecondName : account.secondName
		},

		requestQuery : request.query || {},
		$msgs$ : getMsgs("ru_ru")
	});
}, [ "workspace.student" ]);

get('/workspace/teacher', function(request, response, perms, account)
{
	collection("regions").find().toArray(function(err, regions)
	{
		var regionsNames = [];
		for (var v = 0; v < regions.length; v++)
			regionsNames.push(regions[v].name)
		response.render("workspace/teacher",
		{
			data :
			{
				userLogin : account.login,
				userSurname : account.surname,
				userName : account.name,
				userSecondName : account.secondName,

				menues :
				{
					utils : getGlobalMenu().utils
				}
			},

			requestQuery : request.query || {},
			$msgs$ : getMsgs("ru_ru")
		})
	})
}, [ "workspace.teacher" ])

var defaultTestSettings = {}
var defaultTestingSettings = {}

get('/testing', function(request, response, perms, account)
{
	collection("testings").find(
	{
		_id : new mongoDBmodule.ObjectID(request.query.id)
	}).toArray(function(err, testings)
	{
		if (testings[0])
			collection("tests").find(
			{
				_id : new mongoDBmodule.ObjectID(testings[0].testId)
			}).toArray(function(err, tests)
			{
				if (tests[0])
					if (request.query.questionNumber >= 0 && request.query.questionNumber < tests[0].testQuestions.length)
						collection("testsSettings").find(
						{
							_id : new mongoDBmodule.ObjectID(testings[0].testSettingsId)
						}).toArray(function(err, testsSettings)
						{
							collection("testingsSettings").find(
							{
								_id : new mongoDBmodule.ObjectID(testings[0].testingSettingsId)
							}).toArray(function(err, testingsSettings)
							{
								response.render("testing",
								{
									data :
									{
										userLogin : account.login,
										userSurname : account.surname,
										userName : account.name,
										userSecondName : account.secondName,

										test :
										{
											questionsCount : tests[0].testQuestions.length,
											testQuestionNumber : request.query.questionNumber,
											testQuestion : tests[0].testQuestions[request.query.questionNumber]
										},
										testing : testings[0],
										testSettings : testsSettings[0] || defaultTestSettings,
										testingSettings : testingsSettings[0] || defaultTestingSettings
									},

									requestQuery : request.query || {},
									$msgs$ : getMsgs("ru_ru")
								})
							})
						})
					else response.render('questionNotExist',
					{
						data :
						{
							userLogin : account.login,
							userSurname : account.surname,
							userName : account.name,
							userSecondName : account.secondName,

							requestedQuestion : request.query.questionNumber
						},

						requestQuery : request.query || {},
						$msgs$ : getMsgs("ru_ru")
					})
				else response.render('testNotExist',
				{
					data :
					{
						userLogin : account.login,
						userSurname : account.surname,
						userName : account.name,
						userSecondName : account.secondName,

						requestedTest : testings[0].testId
					},

					requestQuery : request.query || {},
					$msgs$ : getMsgs("ru_ru")
				})
			})
		else response.render('testingNotExist',
		{
			data :
			{
				userLogin : account.login,
				userSurname : account.surname,
				userName : account.name,
				userSecondName : account.secondName,

				requestedTesting : request.query.id
			},

			requestQuery : request.query || {},
			$msgs$ : getMsgs("ru_ru")
		})
	})
}, [])

post('/startTesting', function(request, response, perms, account)
{
	var testing = (
	{
		initiatorLogin : account.login,
		date : new Date(),

		testingLogin : request.body.testingLogin,

		minimalStartingDate : request.body.minimalStartingDate,
		maximalStartingDate : request.body.maximalStartingDate,

		minimalStartingTime : request.body.minimalStartingTime,
		maximalStartingTime : request.body.maximalStartingTime,

		minimalEndingDate : request.body.minimalEndingDate,
		maximalEndingDate : request.body.maximalEndingDate,

		minimalEndingTime : request.body.minimalEndingTime,
		maximalEndingTime : request.body.maximalEndingTime,

		timeLimit : request.body.timeLimit,

		testId : request.body.testId,
		testSettingsId : request.body.testSettingsId,
		testingSettingsId : request.body.testingSettingsId
	})
	collection("testings").insertOne(testing)
	response.end('ok')
}, [])

get('/testCreation', function(request, response, perms, account)
{
	response.render("testCreation",
	{
		data :
		{
			userLogin : account.login,
			userSurname : account.surname,
			userName : account.name,
			userSecondName : account.secondName
		},

		requestQuery : request.query || {},
		$msgs$ : getMsgs("ru_ru")
	})
}, [])

function versionToDomens(version, digital)
{
	var els = version.replace(/[^0-9.]/g, "").split(".")
	if (version.indexOf("a") === version.length - 1)
		els.unshift(digital ? 0 : "a")
	else if (version.indexOf("b") === version.length - 1)
		els.unshift(digital ? 1 : "b")
	else els.unshift(digital ? 2 : "r")
	return els
}

function getTestsOfIdentifierTree(identifier, func)
{
	collection("tests").find(
	{
		identifier : identifier
	}).toArray(function(err, tests)
	{
		var max = 0
		for (var v = 0; v < tests.length; v++)
			max = Math.max(max, versionToDomens(tests[v].version).length)
		var vs = {}
		for (var v = 0; v < tests.length; v++)
			for (var v1 = 0, cvs = vs; v1 < max; v1++)
			{
				var doms = versionToDomens(tests[v].version, true)
				var p = doms[doms.length - max + v1 || 0]
				if (!cvs[p])
					cvs[p] = {}
				if (v1 == max - 1)
					cvs[p] = tests[v]
				cvs = cvs[p]
			}
		var vsArray = []
		function toVersionsArray(arr, obj, lvl, maxLvl)
		{
			for ( var v in obj)
				arr.push(
				{
					index : v,
					object : lvl == maxLvl - 1 ? obj[v] : toVersionsArray([], obj[v], lvl + 1, maxLvl)
				})
			return arr.sort(function(a, b)
			{
				return a.index - b.index
			})
		}
		func(toVersionsArray(vsArray, vs, 0, max), max)
	})
}

function getLastTestOfIdentifier(identifier, func)
{
	getTestsOfIdentifierTree(identifier, function(tree, max)
	{
		var r = tree
		for (var v = 0; v < max; v++)
			r = r[r.length - 1].object
		func(r)
	})
}

get('/test', function(request, response, perms, account)
{
	collection("tests").find(
	{
		_id : new mongoDBmodule.ObjectID(request.query.id)
	}).toArray(function(err, tests)
	{
		response.render("test",
		{
			data :
			{
				userLogin : account.login,
				userSurname : account.surname,
				userName : account.name,
				userSecondName : account.secondName,

				test : tests[0]
			},

			requestQuery : request.query || {},
			$msgs$ : getMsgs("ru_ru")
		})
	})
}, [])

get('/testings', function(request, response, perms, account)
{
	collection("testings").find(request.query.testId ?
	{
		testId : request.query.testId
	} : {}).toArray(function(err, testings)
	{
		var testingsInfo = []
		for (var v = 0; v < testings.length; v++)
			testingsInfo.push(
			{
				testId : testings[v].testId,
				id : testings[v]._id,
				initiatorLogin : testings[v].initiatorLogin,
				testingLogin : testings[v].testingLogin
			})

		response.render("testings",
		{
			data :
			{
				userLogin : account.login,
				userSurname : account.surname,
				userName : account.name,
				userSecondName : account.secondName,

				testingsInfo : testingsInfo
			},

			requestQuery : request.query || {},
			$msgs$ : getMsgs("ru_ru")
		})
	})
}, [])

get('/tests', function(request, response, perms, account)
{
	collection("tests").find().toArray(function(err, tests)
	{
		var testsInfo = []
		function render()
		{
			response.render("tests",
			{
				data :
				{
					userLogin : account.login,
					userSurname : account.surname,
					userName : account.name,
					userSecondName : account.secondName,

					testsInfo : testsInfo
				},

				requestQuery : request.query || {},
				$msgs$ : getMsgs("ru_ru")
			})
		}
		if (!request.query.allVersions)
		{
			var identifiers = {}
			for (var v = 0; v < tests.length; v++)
				identifiers[tests[v].identifier] = true
			var identifiersArray = []
			for ( var v in identifiers)
				identifiersArray.push(v)
			var count = 0
			function next(v)
			{
				getLastTestOfIdentifier(identifiersArray[v], function(test)
				{
					testsInfo.push(
					{
						name : test.name,
						authors : test.authors,
						version : test.version,
						id : test._id,
						comitter : test.comitterLogin
					})
					count++
					if (count == identifiersArray.length)
						render()
				})
			}
			for (var v = 0; v < identifiersArray.length; v++)
				next(v)
		}
		else for (var v = 0; v < tests.length; v++)
			testsInfo.push(
			{
				name : tests[v].name,
				authors : tests[v].authors,
				version : tests[v].version,
				id : tests[v]._id,
				comitter : tests[v].comitterLogin
			})
	})
}, [])

post('/testCreation', function(request, response, perms, account)
{
	var testDB = request.body
	try
	{
		testDB.object = JSON.parse(testDB.code)
	}
	catch (e)
	{
		return response.end(e + "")
	}
	testDB.json = JSON.stringify(testDB.object)
	for ( var v in testDB.object)
		testDB[v] = testDB.object[v]
	testDB.comitterLogin = account.login
	collection("tests").insertOne(testDB)
	return response.end("ok")
}, [])

post('/testing', function(request, response, perms, account)
{
	collection("testingsData").insertOne(
	{
		testingId : request.body.testingId,
		questionNumber : request.body.questionNumber,
		date : new Date(),
		userAnswer : request.body.userAnswer,
		userLogin : account.login,
		body : request.body
	})
	response.end('ok')
}, [])

get('/workspace/dataCollector', function(request, response, perms, account)
{
	response.render("workspace/dataCollector",
	{
		data :
		{
			userLogin : account.login,
			userSurname : account.surname,
			userName : account.name,
			userSecondName : account.secondName
		},

		requestQuery : request.query || {},
		$msgs$ : getMsgs("ru_ru")
	})
}, [ "workspace.dataCollector" ])

get('/workspace/admin', function(request, response, perms, account)
{
	response.render("workspace/admin",
	{
		data :
		{
			userLogin : account.login,
			userSurname : account.surname,
			userName : account.name,
			userSecondName : account.secondName
		},

		requestQuery : request.query || {},
		$msgs$ : getMsgs("ru_ru")
	});
}, [ "workspace.admin" ]);

get('/signout', function(request, response, perms, account, user)
{
	deleteUser(user);
	response.redirect("/signin");
});

application.use(function(request, response, next)
{
	get("users", function(err, users)
	{
		get("accounts", function(err, accounts)
		{
			response.status(404);
			response.render("err404",
			{
				data : accounts[0] ?
				{
					userLogin : accounts[0].login,
					userSurname : accounts[0].surname,
					userName : accounts[0].name,
					userSecondName : accounts[0].secondName,

					requestedUrl : request.url.substring(path.length)
				} :
				{
					requestedUrl : request.url.substring(path.length)
				},

				requestQuery : request.query || {},
				$msgs$ : getMsgs("ru_ru")
			});
		},
		{
			login : new RegExp("^" + (users[0] ? users[0].login : undefined) + "$", "i")
		});
	},
	{
		session : request.connection.remoteAddress
	});
});

function containsAll(obj1, obj2)
{
	if (obj1 === obj2)
		return true;
	for ( var key in obj2)
		if (obj1[key] !== obj2[key])
			return false;
	return true;
}

var collection = exports.collection = function(name)
{
	return mongoDBClient.db("uniTesterDB").collection(name)
}

var get = exports.get = function(name, func, filter)
{
	if (typeof (func) === "function")
		if (name === "groups")
		{
			var groups = [];
			for (var v = 0; v < loadedGroups.length; v++)
				if (containsAll(loadedGroups[v], filter))
					groups.push(loadedGroups[v]);
			func(undefined, groups);
		}
		else collection(name).find(typeof (filter) === "object" ? filter : {}).toArray(func)
}

var getGroupPerms = exports.getGroupPerms = function(group, func)
{
	if (typeof (func) === "function")
		if (group)
			func(group.allPerms);
		else func(undefined);
}

var getAccountPerms = exports.getAccountPerms = function(account, func)
{
	if (typeof (func) === "function")
		if (account)
		{
			var allPerms = [];
			for (var v = 0; v < account.perms.length; v++)
				allPerms.push(account.perms[v]);
			get("members", function(err, members)
			{
				var groupsAndMembersOk = 0
				function check(count)
				{
					if (count === members.length + account.groupsNames.length)
						func(allPerms)
				}
				for (var v = 0; v < account.groupsNames.length; v++)
					get("groups", function(err, groups)
					{
						if (groups[0])
							for (var v = 0; v < groups[0].allPerms.length; v++)
								allPerms.push(groups[0].allPerms[v]);
						else console.error("getAccountPerms: Group with name '" + account.groupsNames[v] + "' doesn't exist!");
						groupsAndMembersOk++
						check(groupsAndMembersOk)
					},
					{
						name : account.groupsNames[v]
					})
				for (var v1 = 0; v1 < members.length; v1++)
					getMemberPerms(members[v1], function(perms)
					{
						for (var v = 0; v < perms.length; v++)
							allPerms.push(perms[v].replace(/\$unitname\$/gi, "[" + members[v1].name + "]"))
						groupsAndMembersOk++
						check(groupsAndMembersOk)
					})
			},
			{
				login : new RegExp("^" + account.login + "$", "i")
			})
		}
		else func(undefined);
}

var getMemberPerms = exports.getMemberPerms = function(member, func)
{
	if (typeof (func) === "function")
		if (member)
		{
			var allPerms = [];
			for (var v = 0; v < member.perms.length; v++)
				allPerms.push(member.perms[v]);
			var groupsOk = 0
			function check(count)
			{
				if (count === member.groupsNames.length)
					func(allPerms)
			}
			for (var v = 0; v < member.groupsNames.length; v++)
				get("groups", function(err, groups)
				{
					if (groups[0])
						for (var v = 0; v < groups[0].allPerms.length; v++)
							allPerms.push(groups[0].allPerms[v]);
					else console.error("getAccountPerms: Group with name '" + member.groupsNames[v] + "' doesn't exist!");
					groupsOk++
					check(groupsOk)
				},
				{
					name : member.groupsNames[v]
				})
		}
		else func(undefined);
}

var getUserPerms = exports.getUserPerms = function(user, func)
{
	if (typeof (func) === "function")
		if (user)
			get("accounts", function(err, accounts)
			{
				getAccountPerms(accounts[0], func);
				if (accounts.length === 0)
					console.error("getUserPerms: Account with login '" + user.login + "' doesn't exist!");
				if (accounts.length > 1)
					console.error("getUserPerms: Account with login '" + user.login + "' isn't the only one!");
			},
			{
				login : new RegExp("^" + user.login + "$", "i")
			});
		else func(undefined);
}

var server;
var consoleUI;

var loadedGroups = [];

var permsUpdate = exports.permsUpdate = function(onUpdated)
{
	collection("groups").find().toArray(function(err, groups)
	{
		loadedGroups = [];

		for (var v = 0; v < groups.length; v++)
			loadedGroups.push(groups[v]);

		function calcAllPerms(stack, group)
		{
			var allPerms = [];
			var stackWithThis = [];
			for (var v = 0; v < stack.length; v++)
				if (stack[v] != group.name)
					stackWithThis.push(stack[v]);
				else
				{
					console.error("PermsUpdate: Group with name '" + group.name + "' already in stack '" + stack + "'!");
					return group.allPerms = allPerms;
				}
			stackWithThis.push(group.name);
			for (var v = 0; v < group.perms.length; v++)
				allPerms.push(group.perms[v]);
			for (var v = 0; v < group.groupsNames.length; v++)
			{
				var group;
				for (var v2 = 0; v2 < loadedGroups.length; v2++)
					if (loadedGroups[v2].name == group.groupsNames[v])
						group = loadedGroups[v2];
				if (group)
				{
					var allPermsOf = calcAllPerms(stackWithThis, group);
					for (var v = 0; v < allPermsOf.length; v++)
						allPerms.push(allPermsOf[v]);
				}
				else console.error("PermsUpdate: Group with name '" + group.groupsNames[v] + "' doesn't exist!");
			}
			return allPerms;
		}
		for (var v = 0; v < loadedGroups.length; v++)
			loadedGroups[v].allPerms = calcAllPerms([], loadedGroups[v]);
		if (onUpdated)
			onUpdated(loadedGroups);
	});
}

init();

var updateHints = exports.updateHints = function(onUpdate)
{
	collection("orderForms").find(
	{
		naming :
		{
			$exists : true
		}
	}).toArray(function(err, forms)
	{
		var hints = [];
		var hintsS = "";
		for (var v = 0; v < forms.length; v++)
			try
			{
				var hint = "";
				var parts = forms[v].naming.split(" ");
				for (var v2 = 0; v2 < parts.length; v2++)
					if (parts[v2].replace(/[^a-zа-я]/g, "") == "")
						hint += (v2 == 0 ? "" : " ") + parts[v2];
					else break;
				hint = hint.toLowerCase();
				if (hintsS.indexOf(hint) == -1)
				{
					hintsS += hint + ",";
					hints.push(
					{
						hint : hint
					});
				}
			}
			catch (e)
			{
				console.warn(e);
			}
		collection("hints").deleteMany({}, function()
		{
			collection("hints").insertMany(hints, onUpdate);
		});
	});
}

var exit = exports.exit = function(code)
{
	console.log("Closing mongoDB client...")
	mongoDBClient.close()
	console.log("MongoDB client closed!")
	console.log("Closing nodeJs server...")
	server.close()
	console.log("NodeJs server closed!")
	console.log("Process exit...")
	process.exit(code)
	console.log("Process exit was called!")
}

var dbInterface;

function init(next)
{
	console.log("Init...")
	initMongoClient(function()
	{
		dbInterface = exports.dbInterface = require("./DataBaseInterface")
		permsUpdate()
		initServer(function()
		{
			initConsoleUI(function()
			{
				console.log(program + " succesfully initialized!")
				if (typeof (next) === "function")
					next()
			})
		})
	})
}

function initMongoClient(next)
{
	console.log("Init MongoClient...")
	mongoClient.connect(url, useNewParser, function(err, client)
	{
		mongoDBClient = exports.mongoDBClient = client
		console.log("MongoClient initialized!")
		if (typeof (next) === "function")
			next()
	})
}

function initServer(next)
{
	console.log("Init Server...")
	server = exports.server = http.createServer(application)
	server.listen(application.get('port'), function()
	{
		console.log('Express server listening on port ' + application.get('port'))
		console.log("Server initialized!")
		if (typeof (next) === "function")
			next()
	})
}

function initConsoleUI(next)
{
	console.log("Init ConsoleUI...")
	consoleUI = require('./ConsoleUI')
	console.log("ConsoleUI initialized!")
	if (typeof (next) === "function")
		next()
}
