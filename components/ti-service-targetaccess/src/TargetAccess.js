/*****************************************************************
 * Copyright (c) 2015 Texas Instruments and others
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *  Paul Gingrich - Initial API and implementation
 *****************************************************************/
var gc = gc || {};
gc.target = gc.target || {};
gc.target.access = gc.target.access || {};

(function() {

	var dsLite;

	var verifying = false;

	var supportedScalarTypes =
	{
			'char' : true,
			'int': true,
			'short': true,
			'long': true,
			'float': true,
			'double': true
	};
	var arrayValueConverters = {};

	var getArrayValueConverter = function(type)
	{
		if (arrayValueConverters[type] === undefined)
		{
			arrayValueConverters[type] = function(data)
			{
				for(var i = data.values.length; i-- > 0; )
				{
					data.values[i] = convert(type, data.values[i]);
				}
				return data.values;
			};
		}
		return arrayValueConverters[type];
	};

	var convert = function(type, value)
	{
		if (type)
		{
			if (type.indexOf('enum') === 0 || supportedScalarTypes[type])
			{
				// check for negative numbers
				if (value.indexOf('0x') === 0 && value.charAt(2) > '7')
				{
					value = (+value)-(1 << (4*(value.length - 2)));  // converts text to number while performing a negation at the same time.
				}
				else
				{
					value = +value;  // converts text to number without altering it.
				}
			}
			else if (type.indexOf('unsigned') === 0)
			{
				value = +value;
			}
		}
		return value;
	};

	var onReadStringComplete = function(data)
	{
		return data.text;
	};

	var readStructValue = function(members)
	{
		if (dsLite)
		{
			var promises = [];
			for(var i = members.length-1; i >= 0; i--)
			{
				promises[i] = dsLite.expressions.evaluate(members[i].expression).then(onReadMemberComplete);
			}
			return Q.all(promises).then(function(results)
			{
				var result = {};
				for(var i = members.length-1; i >= 0; i--)
				{
					result[members[i].name] = results[i];
				}
				return result;
			});
		}
		else
		{
			throw 'target has been disconnected';
		}
	};

	var readArrayValue = function(location, baseType, size, expression)
	{
		if (isNaN(size) || size === 0)
		{
			throw 'invalid target array length of "' + type.substring(pos+1,endPos) + '" for type "' + baseType + '".';
		}
		else if (dsLite)
		{
            if (baseType.indexOf('[') > 0 || baseType.indexOf('struct ') === 0)
            {
                var promises = [];
                for(var i = size; i-- > 0;)
                {
                    promises[i] = dsLite.expressions.evaluate(expression + '[' + i + ']').then(onReadValueComplete);
                }
                return Q.all(promises);
            }
            else if (baseType === 'char')
            {
                return dsLite.expressions.readString(location, size, 0).then(onReadStringComplete);
            }
            else
            {
                return dsLite.memory.read(location, baseType, size).then(getArrayValueConverter(baseType));
            }
		}
		else
		{
			throw 'target has been disconnected';
		}
	};

	var onReadMemberAsDecimalComplete = function(data)
	{
		return +data.value;
	};

	var onReadMemberComplete = function(data)
	{
	    var result;
		if (data.arrayInfo && data.arrayInfo.size)
		{
			result = readArrayValue(data.value, data.arrayInfo.elementType, data.arrayInfo.size, data.arrayInfo.expression);
		}
		else if (data.type === 'char *' || data.type === 'unsigned char *')
		{
			result = dsLite.expressions.readString(+data.value, 80, 0).then(onReadStringComplete);
		}
		else
		{
			result = convert(data.type, data.value);
		}
		return result;
	};

	var onTargetFailed = function(err)
	{
		if (err.message.toLowerCase().indexOf('target failed') >= 0 || err.message.toLowerCase().indexOf('target is not connected') >= 0)
		{
			console.error('TargetAccess.onTargetFailed: '+err.message);
			if (connectionLost)
			{
				connectionLost(err.message);
			}
		}
		throw err;
	};

	var onReadValueComplete = function(data)
	{
		if (connectionMade)
		{
			connectionMade();
		}

		if (data.members.length > 0)
		{
			return readStructValue(data.members);
		}
		else
		{
			return onReadMemberComplete(data);
		}
	};

	var onReadMemoryComplete = function(data)
	{
		if (connectionMade)
		{
			connectionMade();
		}

		return(data);
	};

	gc.target.access.readValue = function(exp)
	{
		verifying = true;
		if (dsLite === undefined)
		{
			return gc.target.access.ready.then(function(dsLite)
			{
				return gc.target.access.readValue(exp);
			});
		}
		return dsLite.expressions.evaluate(exp).then(onReadValueComplete).fail(onTargetFailed);
	};

	var doMemoryWrite = function(arrayOfValuesToWrite, data)
	{
	    if (data.members.length > 0)
	    {
	        throw 'Cannot write array values to a struct';
	    }

        if (!(data.arrayInfo && data.arrayInfo.size))
        {
            throw 'Cannot write array values to a non array type of ' + data.type;
        }

        let valueToWrite = arrayOfValuesToWrite;
        if (data.arrayInfo && data.arrayInfo.size) {
            /* truncate the array to the correct length */
            valueToWrite = arrayOfValuesToWrite.slice(0, data.arrayInfo.size);

            /* terminate char array */
            if (data.arrayInfo.elementType === 'char') {
                valueToWrite[valueToWrite.length-1] = 0;
            }
        }
        return dsLite.memory.write(data.value, data.arrayInfo.elementType, valueToWrite);
	};

	var doWriteValue = function(exp, value)
	{
		if (typeof value === 'object')
		{
			if (value instanceof Array)
			{
			    return dsLite.expressions.evaluate(exp).then(doMemoryWrite.bind(this, value));
			}
			else
			{
	            var promises = [];
				for(var fieldName in value)
				{
					if (value.hasOwnProperty(fieldName))
					{
						promises.push(dsLite.expressions.evaluate(exp + '.' + fieldName + '=' + value[fieldName]));
					}
				}
	            return Q.all(promises);
			}
        }
        else if (typeof value === 'string')
        {
            return dsLite.expressions.evaluate(exp).then(doMemoryWrite.bind(this, (value+'\0').split('').map(e => e.charCodeAt(0))));
        }
		else
		{
			return dsLite.expressions.evaluate(exp + '=' + value);
		}
	};

	gc.target.access.writeValue = function(exp, value)
	{
		if (dsLite === undefined)
		{
			return gc.target.access.ready.then(function(dsLite)
			{
				return gc.target.access.writeValue(exp, value);
			});
		}
		return doWriteValue(exp, value);
	};

	gc.target.access.readMemory = function(addrs, typeOrBytes, size)
	{
		verifying = true;
		size = size || 1;
		typeOrBytes = typeOrBytes || 'int';

		if (dsLite === undefined)
		{
			return gc.target.access.ready.then(function()
			{
				return gc.target.access.readMemory(addrs, typeOrBytes, size);
			});
		}
		return dsLite.memory.read(addrs, typeOrBytes, size).then(onReadMemoryComplete).fail(onTargetFailed);
	};

	gc.target.access.writeMemory = function(addrs, typeOrBytes, arrayOfValues)
	{
	    typeOrBytes = typeOrBytes || 'int';

        if (dsLite === undefined)
        {
            return gc.target.access.ready.then(function()
            {
                return gc.target.access.writeMemory(addrs, typeOrBytes, arrayOfValues);
            });
        }
        return dsLite.memory.write(addrs, typeOrBytes, arrayOfValues).fail(onTargetFailed);
	};

	gc.target.access.isConnected = function()
	{
		return dsLite !== undefined;
	};

	var connectionLost;
	var connectionMade;
	var connectionTimer;
	var CONNECT_TIMEOUT = 10000;  // was 2000 but timeout was hitting before read attempt completed

	var connectionStateListener =
	{
		onStateChanged : function() {},
		removeListener : function() { return this; }
	};

	gc.target.access.addTargetConnectedChangedListener = function(listener)
	{
		if (listener && typeof listener === 'function')
		{
			var nextStateChangedListener = connectionStateListener;
			connectionStateListener =
			{
				onStateChanged : function(state)
				{
					nextStateChangedListener.onStateChanged(state);
					listener(state);
				},
				removeListener : function(listenerToRemove)
				{
					if (listener === listenerToRemove)
					{
						return nextStateChangedListener;
					}
					nextStateChangedListener = nextStateChangedListener.removeListener(listenerToRemove);
					return this;
				}
			};
		}
	};

	gc.target.access.removeTargetConnectedChangedListener = function(listener)
	{
		connectionStateListener = connectionStateListener.removeListener(listener);
	};

	gc.target.access.connect = function(dsLite, backplane, connectionStatusCallback)
	{
		return Q.Promise(function(resolve, reject)
		{
			connectionMade = function()
			{
				// clear initial timeout on no response at all from target.
				if (connectionTimer)
				{
					clearTimeout(connectionTimer);
					connectionTimer = undefined;
				}

				resolve();  // notify target access service that the connection succeed.

				connectionStateListener.onStateChanged(true);

				// create methods to toggle between connected and disconnected state now
				// that we know the com port is appropriate (verified at least once).
				var onConnectionMade = function()
				{
					// toggle active function for next state
					connectionMade = undefined;
					connectionLost = onConnectionLost;

					if (connectionStatusCallback)
					{
						connectionStatusCallback(true);
					}
					connectionStateListener.onStateChanged(true);
				};
				var onConnectionLost = function()
				{
					// toggle active function for next state
					connectionMade = onConnectionMade;
					connectionLost = undefined;

					if (connectionStatusCallback)
					{
						connectionStatusCallback(false);
					}
					connectionStateListener.onStateChanged(false);
				};
				connectionMade = onConnectionMade;
				connectionLost = undefined;
			};
			connectionLost = function(reason)
			{
				connectionLost = undefined;
				connectionMade = undefined;
				var detail = ".";
				if ((reason) && (reason.length > 0)) {
					detail = ": "+reason;
				}
				reject("Communication with Target Failed"+detail);
			};
			connectionTimer = setTimeout(function()
			{
				if (connectionLost)
				{
					connectionLost("No response.");
				}
			}, CONNECT_TIMEOUT);

			gc.target.access.fireReady(dsLite);

			if (verifying === false)
			{
				connectionMade();  // kickstart connection made if no target access commands queued up.
			}
		});
	};

	gc.target.access.disconnect = function()
	{
		var previousFireReady = gc.target.access.fireReady;
		if (previousFireReady === undefined)
		{
			verifying = false;
		}
		if (dsLite)
		{
            dsLite = undefined; // clear old dsLite object.
		    connectionStateListener.onStateChanged(false);
		}
		connectionMade = undefined;
		connectionLost = undefined;
		if (connectionTimer)
		{
			clearTimeout(connectionTimer);
			connectionTimer = undefined;
		}
		gc.target.access.ready = Q.Promise(function(resolve) { gc.target.access.fireReady = resolve; });
		gc.target.access.ready.then(function(dsLiteInstance)
		{
			if (previousFireReady)
			{
				// we need to create a chain of all previous unresolved promises due to disonnect() being called
				// multiple times before connection is actually made, and fire on these promises with the
				// target eventually connects.
				previousFireReady(dsLiteInstance);
			}

			gc.target.access.fireReady = undefined;  // prevent multiple fires on the same resolve method.
			dsLite = dsLiteInstance;
		});
	};
	gc.target.access.disconnect();  // start in disconnected state.
}());
