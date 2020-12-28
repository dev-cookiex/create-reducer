import pick from '@cookiex/dot-object/dist/pick'

export interface AnyAction {
  type: any
  data?: any
  target?: string
}

const combineReducers = <T, A>(
  map: { [K in keyof T]: ( state: T[K], action: A ) => T[K] }
): ( state: T, action: A ) => T => {
  const reducers = Object.entries<( state: any, action: any ) => any>( map )
  return ( state, action ) => {
    let newerState = state

    for ( const [ key, reducer ] of reducers ) {
      const newer = reducer( state[key], action )
      if ( state[key] !== newer )
        newerState = { ...newerState, [key]: newer }
    }

    return newerState
  }
}

type Configuration<T, A> =
  & { [K in keyof A]?: ( state: T, data: A[K] ) => T }
  & {
    [DEFAULT]?: ( state: T ) => T
    [COMPOSE]?: T extends object ? {
      [K in keyof T]?: Configuration<T[K], A>
    } : undefined
  }

interface createReducer {
  DEFAULT: typeof DEFAULT
  COMPOSE: typeof COMPOSE
  <T, A, Act extends AnyAction = AnyAction>(
    config: Configuration<T, A>
  ): ( state: T, action: Act ) => T
}

const createReducer: createReducer = <T, A, Act extends AnyAction = AnyAction>(
  config: Configuration<T, A>
) => {
  const keys = [
    ...Object.getOwnPropertyNames( config ),
    ...Object.getOwnPropertySymbols( config )
  ].filter( privateFilter ) as ( keyof A )[]

  const sub = COMPOSE in config && [
    ...Object.getOwnPropertyNames( config[COMPOSE] ),
    ...Object.getOwnPropertySymbols( config[COMPOSE] )
  ].reduce(
    ( reducers, key ) => ( { ...reducers, [key]: createReducer( config[COMPOSE][key] ) } ),
    {} as any
  )

  const combine = COMPOSE in config && combineReducers<any, any>( sub )

  const reducer = ( state: T, action: Act ) => {
    const key = keys.find( key => key === action.type )

    if ( action.target ) {
      const target = pick( action.target, reducer )
      if ( target ) return target( pick( action.target, state ), action )
    }

    if ( key in config ) return config[key]( state, action.data )

    if ( COMPOSE in config ) return combine( state, action )

    if ( DEFAULT in config ) return config[DEFAULT]( state )

    return ( state ?? {} ) as T
  }

  Object.assign( reducer, sub )

  return reducer
}

export const COMPOSE = Symbol( 'store-reducer-compose' )

export const DEFAULT = Symbol( 'store-reducer-default' )

const privateKeys = [ COMPOSE, DEFAULT ]

const privateFilter = ( key: string | symbol ) => !privateKeys.includes( key as symbol )

createReducer.COMPOSE = COMPOSE

createReducer.DEFAULT = DEFAULT

export default createReducer

interface State {
  user: {
    name: string
  }
}
interface Actions {
  INSEGURE_MERGE: void
  INCREMENT: void
}

