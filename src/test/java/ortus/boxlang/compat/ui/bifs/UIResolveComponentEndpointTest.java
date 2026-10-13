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
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import ortus.boxlang.compat.ui.BaseIntegrationTest;
import ortus.boxlang.runtime.scopes.Key;
import ortus.boxlang.runtime.types.exceptions.CustomException;

public class UIResolveComponentEndpointTest extends BaseIntegrationTest {

	@BeforeAll
	public static void setupFixtures() throws IOException {
		Files.createDirectories( Paths.get( "./biftestpkg" ) );
		Files.writeString( Paths.get( "./biftestpkg/Service.cfc" ), "component { function getData() { return 1; } }" );
		Files.writeString( Paths.get( "./biftestpkg/BoxService.bx" ), "class { function getData() { return 1; } }" );
		Files.writeString( Paths.get( "./RootService.cfc" ), "component { function getData() { return 1; } }" );
	}

	@AfterAll
	public static void teardownFixtures() throws IOException {
		deleteIfExists( Paths.get( "./biftestpkg" ) );
		Files.deleteIfExists( Paths.get( "./RootService.cfc" ) );
	}

	private static void deleteIfExists( Path path ) throws IOException {
		if ( Files.exists( path ) ) {
			Files.walk( path )
			    .sorted( Comparator.reverseOrder() )
			    .forEach( p -> {
				    try {
					    Files.delete( p );
				    } catch ( IOException ignored ) {
				    }
			    } );
		}
	}

	@DisplayName( "It resolves a CFC to its web endpoint" )
	@Test
	public void testResolveCFC() {
		runtime.executeSource(
		    """
		    result = UIResolveComponentEndpoint( "RootService" );
		    """,
		    context
		);

		String endpoint = variables.getAsString( Key.of( "result" ) );
		assertThat( endpoint ).isEqualTo( "/RootService.cfc" );
	}

	@DisplayName( "It resolves a package CFC to its web endpoint" )
	@Test
	public void testResolvePackageCFC() {
		runtime.executeSource(
		    """
		    result = UIResolveComponentEndpoint( "biftestpkg.Service" );
		    """,
		    context
		);

		String endpoint = variables.getAsString( Key.of( "result" ) );
		assertThat( endpoint ).isEqualTo( "/biftestpkg/Service.cfc" );
	}

	@DisplayName( "It resolves a BoxLang .bx class to its web endpoint" )
	@Test
	public void testResolveBoxClass() {
		runtime.executeSource(
		    """
		    result = UIResolveComponentEndpoint( "biftestpkg.BoxService" );
		    """,
		    context
		);

		String endpoint = variables.getAsString( Key.of( "result" ) );
		assertThat( endpoint ).isEqualTo( "/biftestpkg/BoxService.bx" );
	}

	@DisplayName( "It throws ClassNotFoundException when component does not exist" )
	@Test
	public void testThrowsWhenNotFound() {
		assertThrows( CustomException.class, () -> {
			runtime.executeSource(
			    """
			    result = UIResolveComponentEndpoint( "biftestpkg.NonExistent" );
			    """,
			    context
			);
		} );
	}
}
