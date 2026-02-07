/**
 * [BoxLang]
 *
 * Copyright [2023] [Ortus Solutions, Corp]
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
package ortus.boxlang.compat.ui.bifs;

import static com.google.common.truth.Truth.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import ortus.boxlang.compat.ui.BaseIntegrationTest;
import ortus.boxlang.runtime.scopes.Key;

public class AjaxOnLoadTest extends BaseIntegrationTest {

	@DisplayName( "It can register a function to run on page load" )
	@Test
	public void testBasicOnLoad() {
		runtime.executeSource(
		    """
		    result = ajaxOnLoad( "initPage", true );
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "<script type=\"text/javascript\">" );
		assertThat( output ).contains( "if (document.readyState === 'loading')" );
		assertThat( output ).contains( "document.addEventListener('DOMContentLoaded'" );
		assertThat( output ).contains( "initPage()" );
		assertThat( output ).contains( "typeof initPage === 'function'" );
		assertThat( output ).contains( "</script>" );
	}

	@DisplayName( "It handles DOM ready state checking" )
	@Test
	public void testDOMReadyStateHandling() {
		runtime.executeSource(
		    """
		    result = ajaxOnLoad("myFunction", true);
		     """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "if (document.readyState === 'loading')" );
		assertThat( output ).contains( "} else {" );
		// Should handle both cases - when DOM is loading and when already loaded
		assertThat( output ).contains( "myFunction()" );
	}

	@DisplayName( "It includes function existence checking" )
	@Test
	public void testFunctionExistenceCheck() {
		runtime.executeSource(
		    """
		    result = ajaxOnLoad("validateForm", true);
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "if (typeof validateForm === 'function')" );
		assertThat( output ).contains( "validateForm()" );
		assertThat( output ).contains( "console.error('Function validateForm is not defined')" );
	}

	@DisplayName( "It throws error when function name parameter is missing" )
	@Test
	public void testMissingFunctionNameParameter() {
		try {
			runtime.executeSource(
			    """
			    ajaxOnLoad();
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "functionName parameter is required for AjaxOnLoad" );
		}
	}

	@DisplayName( "It throws error when function name parameter is empty" )
	@Test
	public void testEmptyFunctionNameParameter() {
		try {
			runtime.executeSource(
			    """
			    ajaxOnLoad("");
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "functionName parameter is required for AjaxOnLoad" );
		}
	}

	@DisplayName( "It validates JavaScript function name format" )
	@Test
	public void testInvalidFunctionName() {
		try {
			runtime.executeSource(
			    """
			    ajaxOnLoad("123invalid");
			    """,
			    context
			);
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "must be a valid JavaScript function name" );
		}
	}

	@DisplayName( "It accepts valid JavaScript function names" )
	@Test
	public void testValidFunctionNames() {
		runtime.executeSource(
		    """
		    result = "";
		       result &= ajaxOnLoad("validFunction", true);
		       result &= ajaxOnLoad("_privateFunction", true);
		       result &= ajaxOnLoad("$jquery", true);
		       result &= ajaxOnLoad("func123", true);
		       """,
		    context
		);

		String result = variables.getAsString( Key.of( "result" ) );

		assertThat( result ).contains( "validFunction()" );
		assertThat( result ).contains( "_privateFunction()" );
		assertThat( result ).contains( "$jquery()" );
		assertThat( result ).contains( "func123()" );
	}

	@DisplayName( "It rejects invalid JavaScript identifiers" )
	@Test
	public void testInvalidJavaScriptIdentifiers() {
		try {
			runtime.executeSource(
			    """
			    ajaxOnLoad("123func");
			    """,
			    context
			);
			// If we get here, the test should fail
			assertThat( false ).isTrue();
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "must be a valid JavaScript function name" );
		}

		try {
			runtime.executeSource(
			    """
			    ajaxOnLoad("my-function");
			    """,
			    context
			);
			// If we get here, the test should fail
			assertThat( false ).isTrue();
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "must be a valid JavaScript function name" );
		}
	}

	@DisplayName( "It works with named parameters" )
	@Test
	public void testNamedParameters() {
		runtime.executeSource(
		    """
		    result = ajaxOnLoad(functionName="startApp", testMode=true );
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "startApp()" );
		assertThat( output ).contains( "typeof startApp === 'function'" );
	}

	@DisplayName( "It returns a null by default" )
	@Test
	public void testReturnValue() {
		runtime.executeSource(
		    """
		    returnValue = ajaxOnLoad("myFunc");
		    """,
		    context
		);

		String returnValue = variables.getAsString( Key.of( "returnValue" ) );
		assertThat( returnValue ).isNull();
	}

	@DisplayName( "It can be called multiple times" )
	@Test
	public void testMultipleCalls() {
		runtime.executeSource(
		    """
		    result = "";
		          result &= ajaxOnLoad("func1", true);
		          result &= ajaxOnLoad("func2", true);
		          """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "func1()" );
		assertThat( output ).contains( "func2()" );
		// Should contain two separate script blocks
		assertThat( output ).contains( "func1()" );
		assertThat( output ).contains( "func2()" );
	}

	@DisplayName( "It generates self-executing function" )
	@Test
	public void testSelfExecutingFunction() {
		runtime.executeSource(
		    """
		    result = ajaxOnLoad("initialize", true);
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "(function() {" );
		assertThat( output ).contains( "})()" );
	}

	@DisplayName( "It handles function names with underscores and dollar signs" )
	@Test
	public void testSpecialCharacterFunctionNames() {
		runtime.executeSource(
		    """
		    result = ajaxOnLoad("_init_app_$", true);
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "_init_app_$()" );
		assertThat( output ).contains( "typeof _init_app_$ === 'function'" );
	}
}