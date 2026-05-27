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
package ortus.boxlang.compat.ui.components;

import static com.google.common.truth.Truth.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import ortus.boxlang.compat.ui.BaseIntegrationTest;
import ortus.boxlang.runtime.scopes.Key;

public class ProgressBarTest extends BaseIntegrationTest {

	@DisplayName( "It can create a duration-based progress bar" )
	@Test
	public void testDurationProgressBar() {
		runtime.executeSource(
		    """
		    bx:progressbar name="myBar" duration="5000" onComplete="handleDone";
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-progressbar" );
		assertThat( output ).contains( "bx-progressbar-track" );
		assertThat( output ).contains( "bx-progressbar-fill" );
		assertThat( output ).contains( "bx-progressbar-message" );
		assertThat( output ).contains( "id=\"myBar\"" );
		assertThat( output ).contains( "data-duration=\"5000\"" );
		assertThat( output ).contains( "data-interval=\"1000\"" );
		assertThat( output ).contains( "handleDone" );
	}

	@DisplayName( "It can create a bind-based progress bar with CFC expression" )
	@Test
	public void testBindProgressBar() {
		runtime.executeSource(
		    """
		    bx:progressbar name="cfcBar" bind="cfc:mycfc.getstatus()" interval="1700" width="200" onComplete="onfinish";
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-progressbar" );
		assertThat( output ).contains( "id=\"cfcBar\"" );
		assertThat( output ).contains( "data-bind=" );
		assertThat( output ).contains( "mycfc.getstatus" );
		assertThat( output ).contains( "data-interval=\"1700\"" );
		assertThat( output ).contains( "width:200px" );
		assertThat( output ).contains( "onfinish" );
		// Should reference the CFC method in the script
		assertThat( output ).contains( "getstatus" );
		assertThat( output ).contains( "mycfc" );
	}

	@DisplayName( "It sets default width to 400px" )
	@Test
	public void testDefaultWidth() {
		runtime.executeSource(
		    """
		    bx:progressbar name="defaultBar" duration="3000";
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "width:400px" );
	}

	@DisplayName( "It supports custom style colours" )
	@Test
	public void testCustomStyleColours() {
		runtime.executeSource(
		    """
		    bx:progressbar name="styledBar" duration="2000" style="bgcolor:333333;progresscolor:FF0000;textcolor:FFFF00";
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "#333333" );
		assertThat( output ).contains( "#FF0000" );
		assertThat( output ).contains( "#FFFF00" );
	}

	@DisplayName( "It respects autoDisplay=false to hide bar initially" )
	@Test
	public void testAutoDisplayFalse() {
		runtime.executeSource(
		    """
		    bx:progressbar name="hiddenBar" duration="1000" autoDisplay="false";
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "bx-progressbar-hidden" );
	}

	@DisplayName( "It throws when name is not provided" )
	@Test
	public void testThrowsWithoutName() {
		try {
			runtime.executeSource(
			    """
			    bx:progressbar duration="1000";
			    """,
			    context
			);
			assertThat( false ).isTrue(); // Should not reach here
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "name" );
		}
	}

	@DisplayName( "It throws when both bind and duration are specified" )
	@Test
	public void testThrowsMutuallyExclusive() {
		try {
			runtime.executeSource(
			    """
			    bx:progressbar name="badBar" bind="cfc:foo.bar()" duration="1000";
			    """,
			    context
			);
			assertThat( false ).isTrue();
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "mutually exclusive" );
		}
	}

	@DisplayName( "It throws when neither bind nor duration is specified" )
	@Test
	public void testThrowsWithoutBindOrDuration() {
		try {
			runtime.executeSource(
			    """
			    bx:progressbar name="emptyBar";
			    """,
			    context
			);
			assertThat( false ).isTrue();
		} catch ( Exception e ) {
			assertThat( e.getMessage() ).contains( "required" );
		}
	}

	@DisplayName( "It generates ColdFusion.ProgressBar integration script" )
	@Test
	public void testGeneratesControllerScript() {
		runtime.executeSource(
		    """
		    bx:progressbar name="scriptBar" duration="4000" interval="500";
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		// Verify the script wires into ColdFusion.ProgressBar
		assertThat( output ).contains( "ColdFusion.ProgressBar" );
		assertThat( output ).contains( "state._startFn" );
		assertThat( output ).contains( "state._mode = 'duration'" );
	}

	@DisplayName( "It supports custom height" )
	@Test
	public void testCustomHeight() {
		runtime.executeSource(
		    """
		    bx:progressbar name="tallBar" duration="2000" height="30";
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "height:30px" );
	}

	@DisplayName( "It supports onError callback for bind mode" )
	@Test
	public void testOnErrorCallback() {
		runtime.executeSource(
		    """
		    bx:progressbar name="errBar" bind="cfc:svc.check()" onError="handleErr";
		    result = getBoxContext().getBuffer().toString()
		    """,
		    context
		);

		String output = variables.getAsString( Key.of( "result" ) );
		assertThat( output ).contains( "handleErr" );
	}
}
