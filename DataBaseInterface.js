var appjs = require('./app')
var mongoDBClient = appjs.mongoDBClient

function labelIsOk(label)
{
	if (typeof (label) !== "string")
		return;
	var isOk = label.replace(new RegExp("[a-zA-Z0-9]", "g"), "") === ""
	if (!isOk)
		console.error("Label '" + label + "' contains invalid symbols!")
	return isOk
}

var School = exports.School = function(name)
{
	if (!(this instanceof School))
		return new School(name)
	this["_" + appjs.programName + "ObjectType"] = "SCHOOL"
	this.name = name
}

var Unit = exports.Unit = function(schoolName, name, regions, sellingProductsTypes, consumptionProductsTypes)
{
	if (!(this instanceof Unit))
		return new Unit(schoolName, name, regions, sellingProductsTypes, consumptionProductsTypes)
	this["_" + appjs.programName + "ObjectType"] = "UNIT"
	this.schoolName = schoolName
	this.name = name
	this.regions = regions
	this.sellingProductsTypes = sellingProductsTypes
	this.consumptionProductsTypes = consumptionProductsTypes
}

var Parallel = exports.Parallel = function(unitName, name)
{
	if (!(this instanceof Parallel))
		return new Parallel(unitName, name)
	this["_" + appjs.programName + "ObjectType"] = "PARALLEL"
	this.unitName = unitName
	this.name = name
}

var Class = exports.Class = function(parallelName, name)
{
	if (!(this instanceof Class))
		return new Class(parallelName, name)
	this["_" + appjs.programName + "ObjectType"] = "CLASS"
	this.parallelName = parallelName
	this.name = name
}

var Account = exports.Account = function(login, passwordHash, groupsNames, perms, surname, name, secondName)
{
	if (!(this instanceof Account))
		return new Account(login, passwordHash, groupsNames, perms, surname, name, secondName)
	this["_" + appjs.programName + "ObjectType"] = "ACCOUNT"
	this.login = login
	this.passwordHash = passwordHash
	this.groupsNames = groupsNames
	this.perms = perms
	this.surname = surname
	this.name = name
	this.secondName = secondName
}

var Member = exports.Member = function(className, login, groupsNames, perms)
{
	if (!(this instanceof Member))
		return new Member(className, login, groupsNames, perms)
	this["_" + appjs.programName + "ObjectType"] = "MEMBER"
	this.className = className
	this.login = login
	this.groupsNames = groupsNames
	this.perms = perms
}

var Group = exports.Group = function(name, groupsNames, perms)
{
	if (!(this instanceof Group))
		return new Group(name, groupsNames, perms)
	this["_" + appjs.programName + "ObjectType"] = "GROUP"
	this.name = name
	this.groupsNames = groupsNames
	this.perms = perms
}

var User = exports.User = function(login, session, time, languages)
{
	if (!(this instanceof User))
		return new User(login, session, time, languages)
	this["_" + appjs.programName + "ObjectType"] = "USER"
	this.login = login
	this.session = session
	this.time = time
	this.languages = languages
}

function funcDelete(doThis, collection, next)
{
	if (doThis)
		collection.deleteMany({}, next);
	else next();
}

function funcInsert(doThis, collection, next, inserting)
{
	if (doThis)
		collection.insertMany(inserting instanceof Array ? inserting : [ inserting ], next);
	else next();
}

function funcAccounts(doThis, next, accounts, accountsPasswordsStrs)
{
	if (doThis)
		for (var v = 0, v2 = 0; v < accounts.length; v++)
			createAccount(accounts[v], accountsPasswordsStrs[v], function()
			{
				v2++;
				if (v2 === accounts.length)
				{
					console.error("Account already exists!");
					next();
				}
			}, function(cause)
			{
				v2++;
				if (v2 === accounts.length)
				{
					console.error("Account can't be created: " + cause + "!");
					next();
				}
			}, function()
			{
				v2++;
				if (v2 === accounts.length)
				{
					next();
				}
			});
	else next();
}

var createAccount = exports.createAccount = function(account, accountPasswordStr, onAlreadyExists, onNotOk, onOk)
{
	if (account.login.length < 5)
		return onNotOk("loginLengthCantBeLessThan5");
	else if (account.login.length > 30)
		return onNotOk("loginLengthCantBeGreaterThan30");
	else if (!labelIsOk(account.login))
		return onNotOk("loginContainsInvalidSymbols");
	else if (accountPasswordStr.length < 10)
		return onNotOk("passwordLengthCantBeLessThan10");
	else if (accountPasswordStr.length > 30)
		return onNotOk("passwordLengthCantBeGreaterThan30");
	else appjs.get("accounts", function(err, accounts)
	{
		for (var v = 0; v < accounts.length; v++)
			if (accounts[v].login.toLowerCase() == account.login.toLowerCase())
				return onAlreadyExists();
		return appjs.collection("accounts").insertOne(account, function()
		{
			return onOk();
		});
	});
}

function funcLog(doThis, collection, next)
{
	if (doThis)
		collection.find().toArray(function(err, results)
		{
			console.log(results);
			next();
		});
	else next();
}

var recreateAll = exports.recreateAll = function(next)
{
	recreateSchools(function()
	{
		recreateUnits(function()
		{
			recreateParallels(function()
			{
				recreateClasses(function()
				{
					recreateGroups(function()
					{
						recreateAccounts(function()
						{
							recreateMembers(function()
							{
								appjs.permsUpdate();
								if (typeof (next) === "function")
									next();
							})
						})
					})
				})
			})
		})
	})
}

var recreateSchools = exports.recreateSchools = function(next)
{
	console.log("Recreating Schools...");
	var schoolsCollection = appjs.collection("schools");
	var schools = [ new School(appjs.programName) ];
	funcDelete(true, schoolsCollection, function()
	{
		funcInsert(true, schoolsCollection, function()
		{
			funcLog(true, schoolsCollection, function()
			{
				console.log("Schools recreated!");
				if (typeof (next) === "function")
					next();
			});
		}, schools);
	});
}

var recreateUnits = exports.recreateUnits = function(next)
{
	console.log("Recreating Units...");
	var unitsCollection = appjs.collection("units");
	var units = [ new Unit(appjs.programName, "admins", [ "Челябинск" ], [], []) ];
	funcDelete(true, unitsCollection, function()
	{
		funcInsert(true, unitsCollection, function()
		{
			funcLog(true, unitsCollection, function()
			{
				console.log("Units recreated!");
				if (typeof (next) === "function")
					next();
			});
		}, units);
	});
}

var recreateParallels = exports.recreateParallels = function(next)
{
	console.log("Recreating Parallels...");
	var parallelsCollection = appjs.collection("parallels");
	var parallels = [ new Parallel(appjs.programName, "admins", [ "Челябинск" ], [], []) ];
	funcDelete(true, parallelsCollection, function()
	{
		funcInsert(true, parallelsCollection, function()
		{
			funcLog(true, parallelsCollection, function()
			{
				console.log("Parallels recreated!");
				if (typeof (next) === "function")
					next();
			});
		}, parallels);
	});
}

var recreateClasses = exports.recreateClasses = function(next)
{
	console.log("Recreating Classes...");
	var classesCollection = appjs.collection("classes");
	var classes = [ new Class(appjs.programName, "admins", [ "Челябинск" ], [], []) ];
	funcDelete(true, classesCollection, function()
	{
		funcInsert(true, classesCollection, function()
		{
			funcLog(true, classesCollection, function()
			{
				console.log("Classes recreated!");
				if (typeof (next) === "function")
					next();
			});
		}, classes);
	});
}

var recreateGroups = exports.recreateGroups = function(next)
{
	console.log("Recreating Groups...");
	var groupsCollection = appjs.collection("groups");
	var groups = [
			new Group("user", [], [ "workspace" ]),
			new Group("admin", [ 'user' ], [ "workspace.admin", "accounts.management.create",
					"accounts.management.exists.changepassword", "accounts.management.group.give.user",
					"accounts.management.group.manage.user", "accounts.management.group.remove.user",
					"accounts.management.perms.check" ]),
			new Group("studentAdmin", [ 'admin' ], [ "accounts.management.group.give.student",
					"accounts.management.group.manage.student", "accounts.management.group.remove.student" ]),
			new Group("teacherAdmin", [ 'admin' ], [ "accounts.management.group.give.teacher",
					"accounts.management.group.manage.teacher", "accounts.management.group.remove.teacher" ]),
			new Group("dataCollectorAdmin", [ 'admin' ],
					[ "accounts.management.group.give.dataCollector", "accounts.management.group.manage.dataCollector",
							"accounts.management.group.remove.dataCollector" ]),
			new Group("rootadmin", [ 'admin' ], [ "accounts.management.group.give.studentAdmin",
					"accounts.management.group.manage.studentAdmin", "accounts.management.group.remove.studentAdmin",
					"accounts.management.group.give.teacherAdmin", "accounts.management.group.manage.teacherAdmin",
					"accounts.management.group.remove.teacherAdmin",
					"accounts.management.group.give.dataCollectorAdmin",
					"accounts.management.group.manage.dataCollectorAdmin",
					"accounts.management.group.remove.dataCollectorAdmin" ]),
			new Group("student", [ 'user' ], [ "workspace.student", "workspace.student.order",
					"workspace.student.checking", "workspace.student.sending", "edit.order" ]),
			new Group("teacher", [ 'user' ], [ "workspace.teacher", "units.get.companyName", "units.get.name",
					"units.get.regions", "units.get.sellingProductsTypes", "units.get.consumptionProductsTypes" ]),
			new Group("dataCollector", [ 'user' ], [ "workspace.dataCollector" ]),
			new Group("chemistryUtils", [], [ "workspace.utils.subjects.chemistry",
					"workspace.utils.subjects.chemistry.formulaDescription",
					"workspace.utils.subjects.chemistry.periodicTable",
					"workspace.utils.subjects.chemistry.elementInfo" ]) ];
	funcDelete(true, groupsCollection, function()
	{
		funcInsert(true, groupsCollection, function()
		{
			funcLog(true, groupsCollection, function()
			{
				console.log("Groups recreated!");
				if (typeof (next) === "function")
					next();
			});
		}, groups);
	});
}

var recreateAccounts = exports.recreateAccounts = function(next)
{
	console.log("Recreating Accounts...");
	var accountsCollection = appjs.collection("accounts");
	var accounts = [
			new Account("AlexanderDV", appjs.hashCode("WvZs*BRs&bmSpgS1P3iT"), [], [], "Дикун", "Александр",
					"Владимирович"),
			new Account("studentTest", appjs.hashCode("1478963250"), [], [], "Тестовый", "Аккаунт", "Ученика"),
			new Account("teacherTest", appjs.hashCode("1478963250"), [], [], "Тестовый", "Аккаунт", "Учителя"),
			new Account("dataCollectorTest", appjs.hashCode("1478963250"), [], [], "Тестовый", "Аккаунт",
					"Сборщика Данных") ];
	var accountsPasswordsStrs = [ "WvZs*BRs&bmSpgS1P3iT", "1478963250", "1478963250", "1478963250" ];
	funcDelete(true, accountsCollection, function()
	{
		funcAccounts(true, function()
		{
			funcLog(true, accountsCollection, function()
			{
				console.log("Accounts recreated!");
				if (typeof (next) === "function")
					next();
			});
		}, accounts, accountsPasswordsStrs);
	});
}

var recreateMembers = exports.recreateMembers = function(next)
{
	console.log("Recreating Members...");
	var membersCollection = appjs.collection("members");
	var members = [ new Member("admins", "AlexanderDV", [ "rootadmin", "chemistryUtils" ], []),
			new Member("admins", "studentTest", [ "student" ], []),
			new Member("admins", "teacherTest", [ "teacher" ], []),
			new Member("admins", "dataCollectorTest", [ "dataCollector" ], []) ]
	funcDelete(true, membersCollection, function()
	{
		funcInsert(true, membersCollection, function()
		{
			funcLog(true, membersCollection, function()
			{
				console.log("Members recreated!");
				if (typeof (next) === "function")
					next();
			});
		}, members);
	});
}