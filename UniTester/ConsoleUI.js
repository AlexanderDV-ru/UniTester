var appjs = require('./app');

console.error("WARNING: to close program use 'exit' command!");
process.stdin.resume();
process.stdin.on("data", function(data)
{
	function callback(text)
	{
		if (typeof (text) !== "object")
			console.log("Callback: " + text);
		else
		{
			callback("");
			console.log(text);
		}
	}
	var intext = data.toString().trim();
	switch (intext.toLowerCase().split(" ")[0])
	{
		case "splice":
			var msgs1=appjs.getMsgs("ru_ru", "chemicalElementsNames")
			var msgs2=appjs.getMsgs("en_uk", "chemicalElementsNames")
			var keys=[]
			var values=[]
			for(var v in msgs1)
				keys.push(v)
			for(var v in msgs2)
				values.push(msgs2[v])
			for(var v=0;v<keys.length;v++)
				console.log("'"+keys[v]+"': '"+values[v]+"'")
			break
		case "createdescnewels":
			var model=',\n\t"%0":	{"symbol": "%0", 	"id": %1,	/*"name": "iii", */	"mass": "?", 	 "configuration": "?", "group": "?", "subgroup": "?", "period": "?", "type": "?", "status": "theoretically"}'
			var names=appjs.fs.readFileSync("teoreticElements.txt", "utf8").split("\n")[1].split("\t")
			for(var v=0;v<names.length;v++)
				console.log(model.replace(/%0/g,names[v]).replace(/%1/g,v+127))
			break
		case "exit":
			callback("Exit...");
			appjs.exit(0);
			break;
		case "perms":
			switch (intext.toLowerCase().split(" ")[1])
			{
				case "update":
					appjs.permsUpdate(function()
					{
						callback("Perms updated!");
					});
					break;
				default:
					callback("Unknown command '" + (intext.split(" ")[1]) + "'!");
					break;
			}
			break;
		case "account":
			appjs.get("accounts", function(err, accounts)
			{
				if (intext.split(" ").length > 1)
				{
					var account;
					for (var v2 = 0; v2 < accounts.length; v2++)
						if (accounts[v2].login == intext.split(" ")[1])
							account = accounts[v2];
					if (account)
						if (intext.toLowerCase().split(" ").length > 2)
							switch (intext.toLowerCase().split(" ")[2])
							{
								case "allperms":
									appjs.getAccountPerms(account, function(perms)
									{
										callback(perms);
									});
									break;
								case "perms":
									callback(account.perms);
									break;
								case "groups":
									callback(account.permGroupsNames);
									break;
								default:
									callback("Unknown command '" + (intext.split(" ")[2]) + "'!");
									break;
							}
						else callback(account);
					else callback("Account undefined!");
				}
				else
				{
					var accounts2 = [];
					for (var v = 0; v < accounts.length; v++)
						accounts2.push(accounts[v].login);
					callback(accounts2);
				}
			});
			break;
		case "group":
			appjs.get("groups", function(err, groups)
			{
				if (intext.split(" ").length > 1)
				{
					var group;
					for (var v2 = 0; v2 < groups.length; v2++)
						if (groups[v2].name == intext.split(" ")[1])
							group = groups[v2];
					if (group)
						if (intext.toLowerCase().split(" ").length > 2)
							switch (intext.toLowerCase().split(" ")[2])
							{
								case "allperms":
									appjs.getGroupPerms(group, function(perms)
									{
										callback(perms);
									});
									break;
								case "perms":
									callback(group.perms);
									break;
								case "groups":
									callback(group.permGroupsNames);
									break;
								default:
									callback("Unknown command '" + (intext.split(" ")[2]) + "'!");
									break;
							}
						else callback(group);
					else callback("Group undefined!");
				}
				else
				{
					var groups2 = [];
					for (var v = 0; v < groups.length; v++)
						groups2.push(groups[v].name);
					callback(groups2);
				}
			});
			break;
		case "findin":
			appjs.collection(intext.split(" ")[1]).find(
			{
				hint : new RegExp("^" + intext.split(" ")[2], 'i')
			}).toArray(function(err, hints)
			{
				callback(hints);
			});
			break;
		case "recreate":
			switch (intext.toLowerCase().split(" ")[1])
			{
				case "all":
					for ( var key in require.cache)
						if (key.toLowerCase().indexOf("databaseinterface") !== -1)
							delete require.cache[key]
					appjs.dbInterface = require("./DataBaseInterface")
					appjs.dbInterface.recreateAll(function()
					{
						callback("All recreated!");
					})
					break;
				default:
					callback("Unknown command '" + (intext.split(" ")[1]) + "'!");
					break;
			}
			break;
		case "loadorderformsfromfile":
			var namingsA = appjs.fs.readFileSync(intext.split(" ")[1], "utf8").split("\r\n");
			var namings = [];
			for (var v = 0; v < namingsA.length; v++)
				namings.push(
				{
					naming : namingsA[v]
				});
			appjs.collection("orderForms").deleteMany({}, function()
			{
				appjs.collection("orderForms").insertMany(namings, function()
				{
					appjs.updateHints();
				});
			});
			break;
		case "updatehints":
			appjs.updateHints();
			break;
		default:
			callback("Unknown command '" + (intext.split(" ")[0]) + "'!");
			break;
	}
});