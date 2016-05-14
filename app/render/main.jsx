'use strict';
import React from 'react';
import ReactDOM from 'react-dom';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import TitleBar from './components/titlebar.jsx';
import OverviewTable from './components/overview-table.jsx';
import JudgeStatus from './components/judge-status.jsx';
import ResultDrawer from './components/result-drawer.jsx';
import AddProblemDrawer from './components/addProblem-drawer.jsx';
import injectTapEventPlugin from 'react-tap-event-plugin';
// Needed for onTouchTap
// Check this repo:
// https://github.com/zilverline/react-tap-event-plugin
injectTapEventPlugin();

const App = () => (

  <div className="mainApp">
    <MuiThemeProvider muiTheme={getMuiTheme()}>
      <div>
        <TitleBar title={document.title} />
        <div className='container-fluid'>
          <div className='appBody' style={{'paddingTop': '60px', 'height': 420}}>
            <OverviewTable />
            <ResultDrawer />
            <AddProblemDrawer />
          </div>
          <div className='appFoot' style={{'height': 100}}>
            <JudgeStatus/>
          </div>
        </div>
      </div>
    </MuiThemeProvider>
  </div>
);

ReactDOM.render(
  <App />,
  document.getElementById('mainApp')
);
